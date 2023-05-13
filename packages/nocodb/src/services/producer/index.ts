import {Producer} from './producer';
import {KinesisProducer} from './kinesis/kinesis-producer';
import {KafkaProducer} from './kafka/kafka-producer';
import {AwsKafkaProducer} from './kafka/aws-kafka-producer';
import type {Provider} from '@nestjs/common';
import {createMechanism} from "@jm18457/kafkajs-msk-iam-authentication-mechanism";

export const ProducerProvider: Provider = {
  useFactory: async () => {
    if (
      process.env.AWS_KINESIS_CLIENT_ID &&
      process.env.AWS_KINESIS_CLIENT_SECRET &&
      process.env.AWS_KINESIS_REGION
    ) {
      return new KinesisProducer();
    } else if (
      process.env.AWS_KAFKA_BROKERS &&
      process.env.AWS_KAFKA_REGION &&
      process.env.AWS_KAFKA_CLIENT_ID &&
      process.env.AWS_KAFKA_CLIENT_SECRET
    ) {
      return new AwsKafkaProducer();
    } else {
      return {
        sendMessage: async () => {
          // do nothing
        },
      };
    }
  },
  provide: Producer,
};
