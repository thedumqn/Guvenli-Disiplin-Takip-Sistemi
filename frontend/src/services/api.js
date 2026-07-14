import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Cookie'leri gönder
  headers: {
    'Content-Type': 'application/json'
  }
});

let inMemoryAccessToken = null;

export const setAccessToken = (token) => {
  inMemoryAccessToken = token;
};

api.interceptors.request.use(
  (config) => {
    const csrfToken = getCookie('csrfToken');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    if (inMemoryAccessToken) {
      config.headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && 
        error.response?.data?.code === 'TOKEN_EXPIRED' && 
        !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const response = await api.post('/auth/refresh');
        const { accessToken } = response.data;

        if (accessToken) {
          setAccessToken(accessToken);
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  logoutAll: () => api.post('/auth/logout-all'),
  refresh: () => api.post('/auth/refresh'),
  changePassword: (data) => api.post('/auth/change-password', data),
  getMe: () => api.get('/auth/me'),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (sessionId) => api.delete(`/auth/sessions/${sessionId}`),
  getCSRFToken: () => api.get('/auth/csrf-token')
};

export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }),
  toggleLock: (id, lock) => api.post(`/users/${id}/lock`, { lock })
};

export const studentAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  getByNumber: (studentNumber) => api.get(`/students/number/${studentNumber}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  restore: (id) => api.post(`/students/${id}/restore`),
  getDisciplinaryRecords: (id) => api.get(`/students/${id}/disciplinary-records`),
  getFaculties: () => api.get('/students/faculties'),
  getDepartments: (faculty) => api.get('/students/departments', { params: { faculty } })
};

export const disciplinaryAPI = {
  getAll: (params) => api.get('/disciplinary', { params }),
  getById: (id) => api.get(`/disciplinary/${id}`),
  create: (data) => api.post('/disciplinary', data),
  update: (id, data) => api.put(`/disciplinary/${id}`, data),
  delete: (id) => api.delete(`/disciplinary/${id}`),
  updateStatus: (id, status, reason) => api.patch(`/disciplinary/${id}/status`, { status, reason }),
  submitAppeal: (id, appealReason) => api.post(`/disciplinary/${id}/appeal`, { appealReason }),
  decideAppeal: (id, appealStatus, appealDecisionNote) => 
    api.patch(`/disciplinary/${id}/appeal-decision`, { appealStatus, appealDecisionNote }),
  getPenaltyTypes: () => api.get('/disciplinary/penalty-types'),
  getStats: (params) => api.get('/disciplinary/stats', { params })
};

export const auditAPI = {
  getAll: (params) => api.get('/audit', { params }),
  getById: (id) => api.get(`/audit/${id}`),
  getUserActivity: (userId, params) => api.get(`/audit/user/${userId}`, { params }),
  getSecurityEvents: (params) => api.get('/audit/security', { params }),
  getStats: (params) => api.get('/audit/stats', { params }),
  getFailedLogins: (hours) => api.get('/audit/failed-logins', { params: { hours } }),
  getActionTypes: () => api.get('/audit/actions')
};

export default api;
