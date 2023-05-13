import {Injectable} from '@nestjs/common';
import {Admin, Kafka} from 'kafkajs';
import {createMechanism} from '@jm18457/kafkajs-msk-iam-authentication-mechanism';
import {Producer as NcProducer} from '../producer';
import type {Producer} from 'kafkajs';

@Injectable()
export class AwsKafkaProducer extends NcProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    super();
    this.kafka = new Kafka({
      brokers: process.env.AWS_KAFKA_BROKERS.split(/\s*,\s*/),
      ssl: true,
      sasl: createMechanism({
        region: process.env.AWS_KAFKA_REGION,
        credentials: {
          accessKeyId: process.env.AWS_KAFKA_CLIENT_ID,
          secretAccessKey: process.env.AWS_KAFKA_CLIENT_SECRET,
        },
      }),
    });
  }

  async onModuleDestroy(): Promise<void>{
    this.producer && await this.producer.disconnect()
  }

  async onModuleInit() {

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
    });

    await this.producer.connect();
  }

  async sendMessage(topic, message) {
    await this.producer.send({
      topic,
      messages: [{value: message}],
    });
  }


}
