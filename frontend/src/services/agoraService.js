import api from './api';

/**
 * Agora service.
 * The App Certificate never reaches the browser — the backend mints a signed
 * RTC (and RTM) token for an authenticated user on an authorized channel.
 */
export const agoraService = {
  async getToken({ meetingId, channel, role = 'attendee' }) {
    const { data } = await api.post('/agora/token', { meetingId, channel, role });
    return data; // { appId, rtcToken, rtmToken, channel, uid, expireAt }
  },

  appId() {
    return import.meta.env.VITE_AGORA_APP_ID || '';
  },
};

export default agoraService;
