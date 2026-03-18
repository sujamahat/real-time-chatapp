import { io, type Socket } from "socket.io-client";
import { getStoredAccessToken } from "./session";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000", {
      auth: {
        token: getStoredAccessToken() ?? undefined
      },
      withCredentials: true,
      autoConnect: false
    });
  }

  return socket;
}

export function syncSocketAuth() {
  const currentSocket = getSocket();
  currentSocket.auth = {
    token: getStoredAccessToken() ?? undefined
  };
}
