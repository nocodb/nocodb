import type { Server } from 'socket.io';
import type { NcSocket } from '~/interface/config';

export default class NocoPresence {
  public static setupHandlers(_socket: NcSocket) {}

  public static handleDisconnect(_socket: NcSocket, _ioServer: Server) {}
}
