import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Consumer, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  constructor() {
    this.kafka = new Kafka({
      // clientId: 'my-app',
      brokers: ['localhost:9092'],
    });
  }

  onModuleDestroy(): any {}

  async onModuleInit() {
    this.consumer = this.kafka.consumer({
      groupId: '1',
      allowAutoTopicCreation: true,
    });
    await this.consumer.connect();

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
    });

    await this.producer.connect();

    await this.consumer.subscribe({ topic: 'test', fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        console.log({
          value: message.value.toString(),
        });
      },
    });
  }

  async sendMessage(topic, message) {
    await this.producer.send({
      topic,
      messages: [{ value: message }],
    });
  }
}

// docker run -d --name kafka \
//     -e ALLOW_PLAINTEXT_LISTENER=yes \
//     -e KAFKA_ADVERTISED_HOST_NAME=localhost \
//     -e "KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,EXTERNAL://0.0.0.0:9094" \
//     -e "KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092,EXTERNAL://0.0.0.0:9094" \
//     -p 9092:9092 -p 9094:9094 bitnami/kafka
