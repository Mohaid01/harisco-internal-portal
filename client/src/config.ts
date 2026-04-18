// This clever config automatically detects the server's IP from the browser's URL
// This ensures staff members on different PCs are always routed to your server, not "localhost"
const serverHost = window.location.hostname;

export const API_BASE = `http://${serverHost}:5000/api`;
export const AUTH_BASE = `http://${serverHost}:5000/auth/google`;
