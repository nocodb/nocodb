import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { AuthGuard } from '@nestjs/passport';
import type { Socket } from 'socket.io';
import type { OnModuleInit } from '@nestjs/common';
import type { NotificationType } from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    allowedHeaders: ['xc-auth'],
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  private clients: { [id: string]: Socket } = {};

  constructor(private readonly appHooks: AppHooksService) {}

  async onModuleInit() {
    this.server
      .use(async (socket, next) => {
        try {
          const context = new ExecutionContextHost([socket.handshake as any]);
          const guard = new (AuthGuard('jwt'))(context);
          await guard.canActivate(context);
        } catch {}

        next();
      })
      .on('connection', (socket) => {
        if ((socket?.handshake as any)?.user?.id)
          this.clients[(socket?.handshake as any)?.user?.id] = socket;
      });

    // todo:  fix
    this.appHooks.on(
      'notification' as any,
      this.notificationHandler.bind(this),
    );
  }

  // todo: verify if this is the right way to do it, since we are binding this context to the handler
  onModuleDestroy() {
    this.appHooks.removeListener('notification', this.notificationHandler);
  }

  private notificationHandler(notification: NotificationType) {
    if (notification?.fk_user_id && this.clients[notification.fk_user_id]) {
      this.clients[notification.fk_user_id]?.emit('notification', notification);
    }
  }
}
