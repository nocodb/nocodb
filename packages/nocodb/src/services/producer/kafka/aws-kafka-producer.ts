import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { Producer as NcProducer } from '../producer';
import type { Producer } from 'kafkajs';

@Injectable()
export class AwsKafkaProducer extends NcProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    super();
    this.kafka = new Kafka({
      brokers: [
        'b-2.nocohub001apublic.oo62lh.c2.kafka.us-east-2.amazonaws.com:9098',
        'b-1.nocohub001apublic.oo62lh.c2.kafka.us-east-2.amazonaws.com:9098',
      ],

      // process.env.NC_KAFKA_BROKER ?? 'localhost:9092'],
      ssl: true,
      sasl: {
        mechanism: 'aws',
        accessKeyId: 'AKIATUJCOBWTOYIVVMFD',
        secretAccessKey: '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',
        authorizationIdentity: 'arn:aws:iam::249717198246:user/pranavxc',
      },
    });
  }

  onModuleDestroy(): any {}

  async onModuleInit() {
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
    });

    await this.producer.connect();
  }

  async sendMessage(topic, message) {
    await this.producer.send({
      topic,
      messages: [{ value: message }],
    });
  }
}
