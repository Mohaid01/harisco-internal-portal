// In production, Vite will replace import.meta.env.VITE_API_URL
// In development, it falls back to localhost:5000
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const AUTH_BASE = import.meta.env.VITE_AUTH_BASE || 'http://localhost:5000/auth/google';
