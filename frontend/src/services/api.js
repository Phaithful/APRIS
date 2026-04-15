import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      const requestUrl = error.config?.url || '';
      // Don't trigger global logout for auth-related endpoints — those handle their own errors
      const isAuthEndpoint = requestUrl.includes('/api/auth/');
      if (!isAuthEndpoint && currentPath !== '/login' && currentPath !== '/register') {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authLogin = (data) => api.post('/api/auth/login', data);
export const authRegister = (data) => api.post('/api/auth/register', data);
export const authMe = () => api.get('/api/auth/me');
export const authLogout = () => api.post('/api/auth/logout');
export const authUpdateProfile = (data) => api.patch('/api/auth/profile', data);
export const authChangePassword = (data) => api.patch('/api/auth/password', data);

// Farms
export const farmsGet = () => api.get('/api/farms');
export const farmsCreate = (data) => api.post('/api/farms', data);
export const farmGet = (id) => api.get(`/api/farms/${id}`);
export const farmUpdate = (id, data) => api.put(`/api/farms/${id}`, data);
export const farmDelete = (id) => api.delete(`/api/farms/${id}`);

// Flocks
export const flocksGet = (farmId) => api.get(`/api/farms/${farmId}/flocks`);
export const flockCreate = (farmId, data) => api.post(`/api/farms/${farmId}/flocks`, data);
export const flockUpdate = (id, data) => api.put(`/api/flocks/${id}`, data);
export const flockDelete = (id) => api.delete(`/api/flocks/${id}`);

// Assessments
export const assessmentsCreate = (data) => api.post('/api/assessments', data);
export const assessmentsGet = (params) => api.get('/api/assessments', { params });
export const assessmentGet = (id) => api.get(`/api/assessments/${id}`);
export const mitigationComplete = (id) => api.patch(`/api/assessments/mitigations/${id}/complete`);

// Images
export const imageAnalyse = (formData) =>
  api.post('/api/images/analyse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const imageHistoryGet = (params) => api.get('/api/images/history', { params });

// Analytics
export const analyticsRiskTrend = (farmId, days) =>
  api.get('/api/analytics/risk-trend', { params: { farmId, days } });
export const analyticsMortalityTrend = (params) =>
  api.get('/api/analytics/mortality-trend', { params });
export const analyticsDiseaseFrequency = (farmId, days) =>
  api.get('/api/analytics/disease-frequency', { params: { farmId, days } });
export const analyticsSummary = (farmId) =>
  api.get('/api/analytics/summary', { params: { farmId } });

// Alerts
export const alertsGet = (params) => api.get('/api/alerts', { params });
export const alertDismiss = (id) => api.patch(`/api/alerts/${id}/dismiss`);
export const alertsMarkAllRead = () => api.post('/api/alerts/mark-all-read');

// Admin
export const adminStats = () => api.get('/api/admin/stats');
export const adminUsersGet = () => api.get('/api/admin/users');
export const adminUserUpdate = (id, data) => api.patch(`/api/admin/users/${id}`, data);

// Weather
export const weatherGet = (params) => api.get('/api/weather', { params });

// ── AI / APRIS Claude ────────────────────────────────────────────────────────

// Non-streaming: generate assessment narrative
export const aiNarrative = (data) => api.post('/api/ai/narrative', data);

// Non-streaming: encyclopedia question
export const aiEncyclopedia = (data) => api.post('/api/ai/encyclopedia', data);

// Clear chat session on server
export const aiClearSession = (data) => api.post('/api/ai/chat/clear', data);

/**
 * Streaming chat using fetch + Server-Sent Events.
 * Returns an AbortController — call controller.abort() to cancel.
 *
 * @param {object} opts
 * @param {string}   opts.message    - User's message text
 * @param {string}   opts.sessionId  - Session ID for conversation history
 * @param {string}  [opts.farmId]    - Optional farm ID for context injection
 * @param {Function} opts.onDelta    - Called with each streamed text chunk
 * @param {Function} opts.onDone     - Called when stream completes
 * @param {Function} opts.onError    - Called with error string on failure
 */
export function aiChatStream({ message, sessionId, farmId, onDelta, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId, farmId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        onError?.(err.error || `Request failed (${response.status})`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep the last potentially incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.delta) onDelta?.(payload.delta);
            if (payload.done) onDone?.();
            if (payload.error) onError?.(payload.error);
          } catch {
            // malformed JSON chunk — skip
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err.message || 'Connection error');
      }
    }
  })();

  return controller;
}

export default api;
