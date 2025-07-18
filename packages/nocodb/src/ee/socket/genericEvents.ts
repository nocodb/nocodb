import { type PayloadForEvent } from 'nocodb-sdk';
import type { EventType } from 'nocodb-sdk';
import type { NcSocket } from '~/interface/config';

export function sendWelcomeMessage(socket: NcSocket) {
  const welcomePayload: PayloadForEvent<EventType.CONNECTION_WELCOME> = {
    timestamp: Date.now(),
    message: 'Welcome to NocoDB!',
    serverInfo: {
      version: process.env.NC_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    },
    user: socket.handshake.user,
  };

  socket.emit('connection:welcome', welcomePayload);
}

export function sendConnectionError(
  socket: NcSocket,
  error: Error,
  code: string = 'CONNECTION_ERROR',
) {
  const errorPayload: PayloadForEvent<EventType.CONNECTION_ERROR> = {
    timestamp: Date.now(),
    error: {
      code,
      message: error.message,
      details: error.stack,
    },
  };

  socket.emit('connection:error', errorPayload);
}
