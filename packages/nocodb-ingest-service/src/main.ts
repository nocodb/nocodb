import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import KinesisConsumerServer from './kinesis-consumer-server';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      // strategy: new KafkaConsumerServer(),
      strategy: new KinesisConsumerServer(),
    },
  );

  await app.listen();
}
bootstrap();
