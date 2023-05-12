import { Injectable } from '@nestjs/common';
import AWS from 'aws-sdk';

@Injectable()
export class KinesisProducer {
  kinesis: AWS.Kinesis;

  constructor() {
    this.kinesis = new AWS.Kinesis({ region: 'us-east-2' }); // Replace with your region
  }

  async sendMessage(streamName: string, message: string) {
    try {
      const params = {
        Data: message,
        PartitionKey: 'partition-key-1',
        StreamName: streamName,
      };
      const result = await this.kinesis.putRecord(params).promise();
      console.log(
        `Data pushed successfully with sequence number: ${result.SequenceNumber}`,
      );
    } catch (error) {
      console.error(`Error pushing data: ${error}`);
    }
  }
}
