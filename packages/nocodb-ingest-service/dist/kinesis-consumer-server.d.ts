import { CustomTransportStrategy, Server } from '@nestjs/microservices';
export default class KinesisConsumerServer extends Server implements CustomTransportStrategy {
    private kinesis;
    private knex;
    constructor();
    listen(callback: () => void): Promise<void>;
    close(): void;
    getLastIngestedSequenceKey(stream?: string): Promise<any>;
    setLastIngestedSequenceKey(stream: string, sequenceNum: any): Promise<void>;
}
