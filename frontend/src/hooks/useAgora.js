import { useCallback, useEffect, useRef, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

/**
 * Wraps the Agora Web SDK (v4, `agora-rtc-sdk-ng`) for a single call.
 *
 * Responsibilities:
 *  - join/leave an RTC channel with a backend-generated token
 *  - publish local camera + microphone (with graceful permission fallbacks)
 *  - track remote users and their media
 *  - active-speaker volume levels
 *  - screen sharing (with automatic reversion when the browser stops it)
 *  - token renewal before expiry
 *  - connection-state reporting for network loss / recovery
 */

/**
 * Agora wraps DOM errors in AgoraRTCError, so `err.name` is usually
 * "AgoraRTCError" and the original reason lives in `code`/`message`.
 * Without this, a denied permission would be reported as "no camera
 * available" — an untrue message.
 */
function isPermissionError(err) {
  if (!err) return false;
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return true;
  if (typeof err.code === 'string' && err.code.includes('PERMISSION_DENIED')) return true;
  const msg = String(err.message || '');
  return /permission denied|not allowed/i.test(msg);
}

export default function useAgora({
  appId,
  getToken,
  channel,
  uid,
  startWithCam = false,
  startWithMic = false,
  enabled = true,
}) {
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(true);
  const [connectionState, setConnectionState] = useState('CONNECTING');
  const [local, setLocal] = useState({ videoTrack: null, audioTrack: null });
  const [remotes, setRemotes] = useState([]); // [{ uid, videoTrack, audioTrack, hasVideo, hasAudio }]
  const [speakers, setSpeakers] = useState({}); // uid -> volume level 0..100
  const [sharing, setSharing] = useState(false);
  const [screenTrack, setScreenTrack] = useState(null);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [fatalError, setFatalError] = useState(null);

  const clientRef = useRef(null);
  const localRef = useRef({ videoTrack: null, audioTrack: null });
  const screenRef = useRef({ videoTrack: null, audioTrack: null });
  const remotesRef = useRef(new Map());
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const mountedRef = useRef(true);

  const syncRemotes = useCallback(() => {
    if (!mountedRef.current) return;
    setRemotes(Array.from(remotesRef.current.values()));
  }, []);

  /* ------------------------------------------------------------ lifecycle */
  useEffect(() => {
    if (!enabled || !appId || !channel || !uid) return undefined;

    let cancelled = false;
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    const ensureRemote = (user) => {
      if (!remotesRef.current.has(user.uid)) {
        remotesRef.current.set(user.uid, {
          uid: user.uid,
          videoTrack: null,
          audioTrack: null,
          hasVideo: false,
          hasAudio: false,
        });
      }
      return remotesRef.current.get(user.uid);
    };

    client.on('user-joined', (user) => {
      ensureRemote(user);
      syncRemotes();
    });

    client.on('user-published', async (user, mediaType) => {
      const entry = ensureRemote(user);
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === 'video') {
          entry.videoTrack = user.videoTrack;
          entry.hasVideo = true;
        } else {
          entry.audioTrack = user.audioTrack;
          entry.hasAudio = true;
          user.audioTrack?.play();
        }
      } catch (err) {
        // Subscription can fail transiently while a user is disconnecting.
        console.warn('subscribe failed', err);
      }
      syncRemotes();
    });

    client.on('user-unpublished', (user, mediaType) => {
      const entry = remotesRef.current.get(user.uid);
      if (!entry) return;
      if (mediaType === 'video') {
        entry.videoTrack = null;
        entry.hasVideo = false;
      } else {
        entry.audioTrack = null;
        entry.hasAudio = false;
      }
      syncRemotes();
    });

    client.on('user-left', (user) => {
      remotesRef.current.delete(user.uid);
      setSpeakers((prev) => {
        const next = { ...prev };
        delete next[user.uid];
        return next;
      });
      syncRemotes();
    });

    client.on('connection-state-change', (current) => {
      if (!cancelled) setConnectionState(current);
    });

    client.on('volume-indicator', (volumes) => {
      if (cancelled) return;
      const next = {};
      volumes.forEach((v) => {
        next[v.uid] = v.level;
      });
      setSpeakers(next);
    });

    // Renew the RTC token shortly before it expires so long meetings survive.
    client.on('token-privilege-will-expire', async () => {
      try {
        const { rtcToken } = await getTokenRef.current();
        await client.renewToken(rtcToken);
      } catch (err) {
        console.warn('token renewal failed', err);
      }
    });

    const join = async () => {
      setJoining(true);
      setFatalError(null);
      try {
        const { appId: resolvedAppId, rtcToken, uid: assignedUid } = await getTokenRef.current();
        if (cancelled) return;
        await client.join(resolvedAppId || appId, channel, rtcToken, assignedUid ?? uid);
        if (cancelled) return;

        setJoined(true);
        setConnectionState('CONNECTED');

        client.enableAudioVolumeIndicator();

        // Try to publish local media; permission denial must not block joining.
        try {
          if (startWithMic) {
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
              encoderConfig: 'speech_low_quality',
              AEC: true,
              ANS: true,
            });
            localRef.current.audioTrack = audioTrack;
            setMicOn(true);
          }
        } catch (err) {
          setMediaError(
            isPermissionError(err)
              ? 'Microphone access denied — you can still watch and chat.'
              : 'No microphone found on this device.'
          );
        }

        try {
          if (startWithCam) {
            const videoTrack = await AgoraRTC.createCameraVideoTrack({
              encoderConfig: { width: 640, height: 360, frameRate: 15 },
            });
            localRef.current.videoTrack = videoTrack;
            setCamOn(true);
          }
        } catch (err) {
          setMediaError((prev) =>
            prev ||
            (isPermissionError(err)
              ? 'Camera access denied — others will see your avatar.'
              : 'No camera found on this device.')
          );
        }

        const tracks = [localRef.current.audioTrack, localRef.current.videoTrack].filter(Boolean);
        if (tracks.length && !cancelled) {
          await client.publish(tracks);
        }
        if (!cancelled) {
          setLocal({ ...localRef.current });
          setJoining(false);
        }
      } catch (err) {
        console.error('Agora join failed', err);
        if (!cancelled) {
          setFatalError(
            err?.message?.includes('INVALID')
              ? 'Could not join the meeting channel. The meeting may have ended.'
              : 'Could not connect to the meeting. Check your network and try again.'
          );
          setJoining(false);
        }
      }
    };

    join();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      try {
        [localRef.current.videoTrack, localRef.current.audioTrack].forEach((t) => t?.close());
        [screenRef.current.videoTrack, screenRef.current.audioTrack].forEach((t) => t?.close());
      } catch {
        /* ignore */
      }
      localRef.current = { videoTrack: null, audioTrack: null };
      screenRef.current = { videoTrack: null, audioTrack: null };
      clientRef.current?.leave().catch(() => {});
      clientRef.current = null;
      remotesRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, appId, channel, uid]);

  /* -------------------------------------------------------- local toggles */

  const toggleMic = useCallback(async () => {
    const track = localRef.current.audioTrack;
    if (!track) {
      // Microphone was never acquired (permission denied) — try again now.
      try {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'speech_low_quality',
          AEC: true,
          ANS: true,
        });
        localRef.current.audioTrack = audioTrack;
        await clientRef.current?.publish([audioTrack]);
        setLocal({ ...localRef.current });
        setMicOn(true);
        setMediaError(null);
      } catch (err) {
        setMediaError(
          isPermissionError(err)
            ? 'Microphone access denied by the browser.'
            : 'No microphone found on this device.'
        );
      }
      return;
    }
    const next = !micOn;
    await track.setEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const track = localRef.current.videoTrack;
    if (!track) {
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: { width: 640, height: 360, frameRate: 15 },
        });
        localRef.current.videoTrack = videoTrack;
        await clientRef.current?.publish([videoTrack]);
        setLocal({ ...localRef.current });
        setCamOn(true);
        setMediaError(null);
      } catch (err) {
        setMediaError(
          isPermissionError(err)
            ? 'Camera access denied by the browser.'
            : 'No camera found on this device.'
        );
      }
      return;
    }
    const next = !camOn;
    await track.setEnabled(next);
    setCamOn(next);
  }, [camOn]);

  /* -------------------------------------------------------- screen share */

  const stopShare = useCallback(async () => {
    const client = clientRef.current;
    const screen = screenRef.current;
    if (!client || !screen.videoTrack) return;
    try {
      await client.unpublish([screen.videoTrack, screen.audioTrack].filter(Boolean));
    } catch {
      /* ignore */
    }
    [screen.videoTrack, screen.audioTrack].forEach((t) => t?.close());
    screenRef.current = { videoTrack: null, audioTrack: null };
    setSharing(false);
    setScreenTrack(null);

    // Restore the camera feed for others.
    const cam = localRef.current.videoTrack;
    if (cam && camOn) {
      try {
        await client.publish([cam]);
      } catch {
        /* ignore */
      }
    }
  }, [camOn]);

  const startShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client || sharing) return;
    try {
      const result = await AgoraRTC.createScreenVideoTrack({
        encoderConfig: '1080p_1',
        audio: 'auto',
      });
      const tracks = Array.isArray(result) ? result : [result];
      const video = tracks.find((t) => t.trackMediaType === 'video');
      const audio = tracks.find((t) => t.trackMediaType === 'audio');
      if (!video) return;

      const cam = localRef.current.videoTrack;
      if (cam) {
        try {
          await client.unpublish([cam]);
        } catch {
          /* ignore */
        }
      }
      await client.publish(tracks.filter(Boolean));

      screenRef.current = { videoTrack: video, audioTrack: audio };
      setSharing(true);
      setScreenTrack(video);

      // Fires when the user clicks the browser's own "Stop sharing" button.
      const onEnded = () => stopShare();
      video.on('track-ended', onEnded);
      audio?.on('track-ended', onEnded);
    } catch (err) {
      setMediaError(
        isPermissionError(err)
          ? 'Screen sharing permission was denied.'
          : 'Screen sharing is not supported on this device.'
      );
    }
  }, [sharing, stopShare]);

  const toggleShare = useCallback(() => {
    if (sharing) stopShare();
    else startShare();
  }, [sharing, startShare, stopShare]);

  const leave = useCallback(async () => {
    const client = clientRef.current;
    try {
      [screenRef.current.videoTrack, screenRef.current.audioTrack].forEach((t) => t?.close());
      [localRef.current.videoTrack, localRef.current.audioTrack].forEach((t) => t?.close());
    } catch {
      /* ignore */
    }
    screenRef.current = { videoTrack: null, audioTrack: null };
    localRef.current = { videoTrack: null, audioTrack: null };
    setLocal({ videoTrack: null, audioTrack: null });
    setSharing(false);
    setScreenTrack(null);
    setJoined(false);
    await client?.leave().catch(() => {});
  }, []);

  return {
    joined,
    joining,
    connectionState,
    local,
    remotes,
    speakers,
    sharing,
    screenTrack,
    camOn,
    micOn,
    mediaError,
    fatalError,
    clearMediaError: () => setMediaError(null),
    toggleMic,
    toggleCam,
    toggleShare,
    leave,
  };
}
