import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import type { Producer } from 'kafkajs';
import { Producer as NcProducer } from '../producer';

@Injectable()
export class KafkaProducer extends NcProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    super();
    this.kafka = new Kafka({
      brokers: [process.env.NC_KAFKA_BROKER ?? 'localhost:9092'],
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
