import { CustomTransportStrategy, Server } from '@nestjs/microservices';
export default class KinesisConsumerServer extends Server implements CustomTransportStrategy {
    constructor();
    listen(callback: () => void): Promise<void>;
    close(): void;
}
