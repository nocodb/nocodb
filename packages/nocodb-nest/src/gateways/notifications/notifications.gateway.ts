import {SubscribeMessage, WebSocketGateway, WebSocketServer} from '@nestjs/websockets';
import {Server} from "socket.io";

@WebSocketGateway({
  cors: {
    origin: '*',
    allowedHeaders: ['xc-auth'],
    credentials: true,
  },
  namespace: 'notifications'
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    console.log('kkdkdkdkdkd')
    return 'Hello world!';
  }
}
