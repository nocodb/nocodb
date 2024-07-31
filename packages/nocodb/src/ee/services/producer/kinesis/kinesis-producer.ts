import { Injectable, Logger } from '@nestjs/common';

import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import { Producer } from '../producer';

@Injectable()
export class KinesisProducer extends Producer {
  sendMessages(_topic: string, _messages: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private kinesis: KinesisClient;
  private logger = new Logger(KinesisProducer.name);

  constructor() {
    super();

    this.kinesis = new KinesisClient({
      region: process.env.AWS_KINESIS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_KINESIS_CLIENT_ID,
        secretAccessKey: process.env.AWS_KINESIS_CLIENT_SECRET,
      },
    });
  }

  async sendMessage(streamName: string, message: string) {
    try {
      const inputCommand = new PutRecordCommand({
        StreamName: streamName,
        Data: Buffer.from(message),
        PartitionKey:
          process.env.AWS_KINESIS_PARTITION_KEY ?? 'partition-key-1',
      });

      const result = await this.kinesis.send(inputCommand);
      this.logger.verbose(
        `Data pushed successfully with sequence number: ${result.SequenceNumber}`,
      );
    } catch (error) {
      this.logger.error(`Error pushing data: ${error}`);
    }
  }
}
