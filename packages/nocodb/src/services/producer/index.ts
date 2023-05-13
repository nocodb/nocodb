import { Producer } from './producer';
import { KinesisProducer } from './kinesis/kinesis-producer';
import { KafkaProducer } from './kafka/kafka-producer';
import type { Provider } from '@nestjs/common';

export const ProducerProvider: Provider = {
  useFactory: async () => {
    if (process.env.NC_PRODUCER_TYPE === 'kinesis') {
      return new KinesisProducer();
    } else if (process.env.NC_PRODUCER_TYPE === 'kafka') {
      return new KafkaProducer();
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
