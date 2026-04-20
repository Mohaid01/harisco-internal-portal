// Configured for office-wide access via MikroTik DNS
// Domain: portal.harisco.com
const isDev = import.meta.env?.DEV;

export const API_BASE = isDev ? 'http://localhost:5000/api' : `http://portal.harisco.com:8080/api`;
export const AUTH_BASE = isDev ? 'http://localhost:5000/auth/google' : `http://portal.harisco.com:8080/auth/google`;

console.log("📍 HarisCo Portal Office Config:", { API_BASE, AUTH_BASE });
