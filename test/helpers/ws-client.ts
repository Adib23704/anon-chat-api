import { io, type Socket } from 'socket.io-client';

export type ConnectArgs = { url: string; token: string; roomId: string };

export function connect({ url, token, roomId }: ConnectArgs): Socket {
  return io(`${url}/chat`, {
    transports: ['websocket'],
    query: { token, roomId },
    forceNew: true,
    reconnection: false,
  });
}

export function once<T = unknown>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}
