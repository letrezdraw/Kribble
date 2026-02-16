import axios from 'axios';

// Use relative URL for same-origin requests (works with Express serving client)
const API_URL = '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if not on the initial auth check
      const isAuthCheck = error.config?.url === '/auth/me';
      if (!isAuthCheck) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  
  guest: (username?: string) =>
    api.post('/auth/guest', { username }),
  
  me: () => api.get('/auth/me'),
  
  updateProfile: (data: { username?: string; avatarId?: string }) =>
    api.put('/auth/profile', data),
};

// Room API
export const roomApi = {
  list: () => api.get('/rooms'),
  
  create: (data: { name: string; settings?: object }) =>
    api.post('/rooms', data),
  
  get: (roomId: string) => api.get(`/rooms/${roomId}`),
  
  join: (roomId: string, password?: string) =>
    api.post(`/rooms/${roomId}/join`, { password }),
  
  leave: (roomId: string) => api.post(`/rooms/${roomId}/leave`),
  
  start: (roomId: string) => api.post(`/rooms/${roomId}/start`),
  
  kick: (roomId: string, playerId: string) =>
    api.post(`/rooms/${roomId}/kick`, { playerId }),
};

// User API
export const userApi = {
  getProfile: (userId: string) => api.get(`/users/${userId}`),
  
  getStats: (userId: string) => api.get(`/users/${userId}/stats`),
  
  getHistory: (userId: string) => api.get(`/users/${userId}/history`),
  
  getLeaderboard: () => api.get('/users/leaderboard'),
};

// Words API
export const wordsApi = {
  getCategories: () => api.get('/words/categories'),
  
  getWords: (category?: string) => api.get('/words', { params: { category } }),
};
