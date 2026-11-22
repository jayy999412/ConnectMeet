import api from './api';

/** Chat service — messages are persisted in MySQL and scoped per meeting. */
export const chatService = {
  async history(meetingId) {
    const { data } = await api.get(`/meetings/${meetingId}/messages`);
    return data;
  },

  async send(meetingId, message) {
    const { data } = await api.post(`/meetings/${meetingId}/messages`, { message });
    return data;
  },
};

export default chatService;
