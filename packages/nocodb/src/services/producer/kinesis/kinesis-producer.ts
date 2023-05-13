import { Injectable, Logger } from '@nestjs/common';
import AWS from 'aws-sdk';
import { Producer } from '../producer';

@Injectable()
export class KinesisProducer extends Producer {
  private kinesis: AWS.Kinesis;
  private logger = new Logger(KinesisProducer.name);

  constructor() {
    super();
    this.kinesis = new AWS.Kinesis({
      region: process.env.NC_KINESIS_REGION,
      credentials: {
        accessKeyId: process.env.NC_KINESIS_CLIENT_ID,
        secretAccessKey: process.env.NC_KINESIS_CLIENT_SECRET,
      },
    });
  }

  async sendMessage(streamName: string, message: string) {
    try {
      const params = {
        Data: message,
        // todo: use different partition key to avoid hot shard
        PartitionKey: process.env.NC_KINESIS_PARTITION_KEY ?? 'partition-key-1',
        StreamName: streamName,
      };
      const result = await this.kinesis.putRecord(params).promise();
      // this.logger.log(
      //   `Data pushed successfully with sequence number: ${result.SequenceNumber}`,
      // );
    } catch (error) {
      this.logger.error(`Error pushing data: ${error}`);
    }
  }
}
