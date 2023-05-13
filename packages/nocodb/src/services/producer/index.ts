import { Producer } from './producer';
import { KinesisProducer } from './kinesis/kinesis-producer';
import { KafkaProducer } from './kafka/kafka-producer';
import { AwsKafkaProducer } from './kafka/aws-kafka-producer';
import type { Provider } from '@nestjs/common';

export const ProducerProvider: Provider = {
  useFactory: async () => {
    if (
      process.env.NC_KINESIS_CLIENT_ID &&
      process.env.NC_KINESIS_CLIENT_SECRET &&
      process.env.NC_KINESIS_REGION
    ) {
      return new KinesisProducer();
    } /*else if (process.env.NC_KAFKA_BROKER) {
      return new KafkaProducer();
    }*/ else {
      return new AwsKafkaProducer();

      return {
        sendMessage: async () => {
          // do nothing
        },
      };
    }
  },
  provide: Producer,
};
