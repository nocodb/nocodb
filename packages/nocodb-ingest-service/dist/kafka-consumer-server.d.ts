import { CustomTransportStrategy, Server } from '@nestjs/microservices';
export default class KafkaConsumerServer extends Server implements CustomTransportStrategy {
    private kafka;
    private consumer;
    constructor();
    listen(callback: () => void): Promise<void>;
    close(): void;
}
