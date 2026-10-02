import type { Server } from 'node:http';
import type { Socket } from 'node:net';

/** Tracks only connections accepted by this host, including partial bodies. */
export function ownedServerLifecycle(server: Server) {
  const sockets = new Set<Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  let closing: Promise<void> | undefined;
  return {
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      });
      return closing;
    },
    destroyConnections() {
      for (const socket of sockets) socket.destroy();
    },
  };
}
