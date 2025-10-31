// File: web/src/auth.js
import axios from 'axios';

const TOKEN_KEY = 'admin_token';
export const API_URL = 'http://localhost:8000';

// --- Token Management ---
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// --- Axios API Instance ---
export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ⭐️ ดักจับ Token หมดอายุ (401/403) ⭐️
api.interceptors.response.use(
  (response) => response, // ถ้าสำเร็จ ก็ส่งต่อไป
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('Authentication error, logging out...');
      removeToken();
      // Reload หน้าเว็บเพื่อบังคับให้กลับไปหน้า Login
      window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);