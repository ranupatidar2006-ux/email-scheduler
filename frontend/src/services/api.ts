import axios from 'axios';
import type { PaginatedResponse, Email, SlackStatus, ScheduleRequest } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----
export async function googleLogin(token: string) {
  const { data } = await api.post('/auth/google', { token });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

// ---- Emails ----
export async function scheduleEmails(payload: ScheduleRequest) {
  const { data } = await api.post('/emails/schedule', payload);
  return data;
}

export async function getScheduledEmails(page = 1, limit = 20): Promise<PaginatedResponse<Email>> {
  const { data } = await api.get('/emails/scheduled', { params: { page, limit } });
  return data;
}

export async function getSentEmails(page = 1, limit = 20): Promise<PaginatedResponse<Email>> {
  const { data } = await api.get('/emails/sent', { params: { page, limit } });
  return data;
}

export async function searchEmails(params: {
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Email>> {
  const { data } = await api.get('/emails/search', { params });
  return data;
}

// ---- File Upload ----
export async function uploadCSV(file: File): Promise<{ total: number; emails: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/upload/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ---- Slack ----
export async function getSlackConnectUrl(): Promise<{ url: string }> {
  const { data } = await api.get('/slack/connect');
  return data;
}

export async function getSlackStatus(): Promise<SlackStatus> {
  const { data } = await api.get('/slack/status');
  return data;
}

export async function disconnectSlack(): Promise<void> {
  await api.post('/slack/disconnect');
}

export default api;
