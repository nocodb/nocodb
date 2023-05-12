import { NestFactory } from '@nestjs/core';
import {MicroserviceOptions, Transport} from '@nestjs/microservices';
import { AppModule } from './app.module';


async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        consumer:{
          minBytes: 1000,
          groupId: 'my-group'
        },
        client: {
          brokers: ['localhost:9092'],
        },
      },
    },
  );

  await app.listen();
}
bootstrap();
