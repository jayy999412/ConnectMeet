import { useCallback, useEffect, useRef, useState } from 'react';
import chatService from '../services/chatService.js';

/**
 * Meeting chat.
 *
 * - History + persistence live in MySQL through the REST API.
 * - Real-time delivery uses Agora RTM when credentials allow it; a short
 *   polling fallback keeps chat working even if RTM is unavailable, so the
 *   feature is never silently broken.
 * - Messages are de-duplicated by their database id.
 */
export default function useMeetingChat({ meetingId, appId, rtmToken, uid, userName, enabled }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rtmState, setRtmState] = useState('idle'); // idle | connecting | live | fallback

  const idsRef = useRef(new Set());
  const rtmRef = useRef(null);
  const channelRef = useRef(null);

  const merge = useCallback((list) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      list.forEach((m) => {
        if (m && m.id != null) byId.set(m.id, m);
      });
      const next = Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      return next;
    });
    list.forEach((m) => m?.id != null && idsRef.current.add(m.id));
  }, []);

  /* ------------------------------------------------------- load history */
  useEffect(() => {
    if (!meetingId || !enabled) return undefined;
    let alive = true;
    chatService
      .history(meetingId)
      .then((data) => {
        if (!alive) return;
        merge(data.messages || []);
      })
      .catch(() => {
        /* history errors are non-fatal — the panel still allows sending */
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [meetingId, enabled, merge]);

  /* ------------------------------------------- polling fallback (always) */
  useEffect(() => {
    if (!meetingId || !enabled) return undefined;
    const tick = async () => {
      try {
        const data = await chatService.history(meetingId);
        merge(data.messages || []);
      } catch {
        /* transient network error — next tick retries */
      }
    };
    const id = setInterval(tick, 8000);
    return () => clearInterval(id);
  }, [meetingId, enabled, merge]);

  /* ------------------------------------------------------------ RTM link */
  useEffect(() => {
    if (!enabled || !appId || !rtmToken || uid == null) return undefined;
    let alive = true;

    const connect = async () => {
      setRtmState('connecting');
      let AgoraRTM;
      try {
        ({ default: AgoraRTM } = await import('agora-rtm-sdk'));
      } catch {
        setRtmState('fallback');
        return;
      }

      try {
        // agora-rtm-sdk 1.5.x exposes createInstance(appId) — there is no
        // `RTM` constructor. The token and uid are supplied to login().
        if (typeof AgoraRTM?.createInstance !== 'function') {
          throw new Error('Unexpected agora-rtm-sdk API');
        }
        const client = AgoraRTM.createInstance(appId);
        await client.login({ uid: String(uid), token: rtmToken });
        if (!alive) {
          client.logout().catch(() => {});
          return;
        }

        // Keep the RTM session alive for long meetings (token TTL is 1 hour).
        client.on('TokenPrivilegeWillExpire', () => {
          client.renewToken(rtmToken).catch(() => {});
        });

        const channel = client.createChannel(String(meetingId));
        channel.on('message', (msg) => {
          try {
            const payload = JSON.parse(msg.message);
            if (payload?.id != null && idsRef.current.has(payload.id)) return;
            merge([payload]);
          } catch {
            /* ignore malformed payloads */
          }
        });

        await channel.join();
        if (!alive) {
          channel.leave().catch(() => {});
          client.logout().catch(() => {});
          return;
        }

        rtmRef.current = client;
        channelRef.current = channel;
        setRtmState('live');
      } catch (err) {
        console.warn('RTM unavailable, using polling fallback:', err?.message || err);
        if (alive) setRtmState('fallback');
      }
    };

    connect();

    return () => {
      alive = false;
      channelRef.current?.leave().catch(() => {});
      rtmRef.current?.logout().catch(() => {});
      channelRef.current = null;
      rtmRef.current = null;
      setRtmState('idle');
    };
  }, [enabled, appId, rtmToken, uid, meetingId, merge]);

  /* ------------------------------------------------------------- sending */
  const send = useCallback(
    async (text) => {
      const message = (text || '').trim();
      if (!message || !meetingId) return;
      setSending(true);
      try {
        const data = await chatService.send(meetingId, message);
        if (data?.message && !idsRef.current.has(data.message.id)) {
          idsRef.current.add(data.message.id);
          merge([data.message]);
        }

        // Broadcast for instant delivery to other participants.
        if (channelRef.current && data?.message) {
          channelRef.current
            .sendMessage({
              text: JSON.stringify({
                ...data.message,
                sender_name: data.message.sender_name || userName,
              }),
            })
            .catch(() => {
              /* polling fallback will deliver it anyway */
            });
        }
        return data.message;
      } finally {
        setSending(false);
      }
    },
    [meetingId, merge, userName]
  );

  return { messages, loading, sending, send, rtmState };
}
