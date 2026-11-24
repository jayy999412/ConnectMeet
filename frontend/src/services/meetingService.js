import api from './api';

/** Meeting service — creation, joining, history and participant lifecycle. */
export const meetingService = {
  async create(payload) {
    const { data } = await api.post('/meetings', payload);
    return data;
  },

  async list(params = {}) {
    const { data } = await api.get('/meetings', { params });
    return data;
  },

  async get(id) {
    const { data } = await api.get(`/meetings/${id}`);
    return data;
  },

  async join(id, { password } = {}) {
    const { data } = await api.post(`/meetings/${id}/join`, { password });
    return data;
  },

  /**
   * Guest entry: join with a display name only — no account required.
   * Returns `{ token, user, meeting, participant, ... }`; the caller adopts the
   * token so every subsequent request is authenticated as that guest.
   */
  async guestJoin(id, { name, password } = {}) {
    const { data } = await api.post(`/meetings/${id}/guest-join`, { name, password });
    return data;
  },

  async leave(id) {
    const { data } = await api.post(`/meetings/${id}/leave`);
    return data;
  },

  async end(id) {
    const { data } = await api.post(`/meetings/${id}/end`);
    return data;
  },

  async history() {
    const { data } = await api.get('/meetings/history');
    return data;
  },

  async participants(id) {
    const { data } = await api.get(`/meetings/${id}/participants`);
    return data;
  },

  /** Host only: remove a participant from the meeting. */
  async removeParticipant(meetingId, userId) {
    const { data } = await api.delete(`/meetings/${meetingId}/participants/${userId}`);
    return data;
  },

  /** Resolve a meeting_code (from an invite link) to its numeric id. */
  async resolve(code) {
    const { data } = await api.get(`/meetings/code/${encodeURIComponent(code)}`);
    return data;
  },
};

export default meetingService;
