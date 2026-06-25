import { io } from "socket.io-client";

// In production, set REACT_APP_SERVER_URL to your deployed signaling
// server (e.g. https://your-app.onrender.com). Falls back to localhost
// for local development.
const URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5050";

export const socket = io(URL);
export const navbarBrand = "YourVideoShare";
