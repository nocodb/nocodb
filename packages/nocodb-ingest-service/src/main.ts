import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import KinesisConsumerServer from './kinesis-consumer-server';
import KafkaConsumerServer from './kafka-consumer-server';

function getServiceStrategy(): any {
  if (process.env.NC_KAFKA_BROKER) {
    return new KafkaConsumerServer();
  } else if (process.env.NC_KINESIS_CLIENT_ID) {
    return new KinesisConsumerServer();
  } else {
    throw new Error('No service strategy configured');
  }
}

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      strategy: getServiceStrategy(),
    },
  );
  await app.listen();
}
bootstrap();
