import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000", {
      withCredentials: true,
      autoConnect: false
    });
  }

  return socket;
}

