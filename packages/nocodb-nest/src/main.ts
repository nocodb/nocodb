import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cors from 'cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    cors({
      exposedHeaders: 'xc-db-response',
    }),
  );
  await app.listen(8080);
}
bootstrap();
