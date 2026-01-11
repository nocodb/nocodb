import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
// @ts-ignore
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule as NestJsEventEmitter } from '@nestjs/event-emitter';
import { SentryModule } from '@sentry/nestjs/setup';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

import type { MiddlewareConsumer } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';
import { NocoModule } from '~/modules/noco.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { GlobalExceptionFilter } from '~/filters/global-exception/global-exception.filter';
import { GlobalMiddleware } from '~/middlewares/global/global.middleware';
import { GuiMiddleware } from '~/middlewares/gui/gui.middleware';
import { EventEmitterModule } from '~/modules/event-emitter/event-emitter.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

import appConfig from '~/app.config';
import { ExtractIdsMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import { RawBodyMiddleware } from '~/middlewares/raw-body.middleware';
import { JsonBodyMiddleware } from '~/middlewares/json-body.middleware';

import { UrlEncodeMiddleware } from '~/middlewares/url-encode.middleware';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';

export const ceModuleConfig = {
  imports: [
    AuthModule,
    NocoModule,
    EventEmitterModule,
    JobsModule,
    NestJsEventEmitter.forRoot(),
    ConfigModule.forRoot({
      load: [() => appConfig],
      isGlobal: true,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService<AppConfig>) => {
        const redisUrl = getRedisURL(NC_REDIS_TYPE.THROTTLER);

        const config: any = {
          throttlers: [
            {
              name: 'default',
              ttl: 60000,
              limit: 100,
            },
          ],
          skipIf: () => false,
        };

        if (redisUrl) {
          try {
            const ioredis = await import('ioredis');
            const redis = new ioredis.default(redisUrl, {
              enableOfflineQueue: false,
              maxRetriesPerRequest: 3,
            });

            await redis.ping();

            config.storage = new ThrottlerStorageRedisService(redis);
            console.log('Throttler: Using Redis storage');
          } catch (error) {
            console.warn(
              'Throttler: Failed to connect to Redis, using in-memory storage',
              error.message,
            );
          }
        } else {
          console.log(
            'Throttler: Using in-memory storage (set NC_THROTTLER_REDIS for Redis)',
          );
        }

        return config;
      },
    }),
    ...(process.env.NC_SENTRY_DSN ? [SentryModule.forRoot()] : []),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ExtractIdsMiddleware,
    },
  ],
};

@Module(ceModuleConfig)
export class AppModule {
  // Global Middleware
  configure(consumer: MiddlewareConsumer) {
    const dashboardPath = process.env.NC_DASHBOARD_URL ?? '/dashboard';
    consumer
      .apply(RawBodyMiddleware)
      .forRoutes({
        path: '/api/payment/webhook',
        method: RequestMethod.POST,
      })
      .apply(JsonBodyMiddleware)
      .forRoutes('*')
      .apply(UrlEncodeMiddleware)
      .forRoutes('*')
      .apply(GuiMiddleware)
      .forRoutes({ path: `${dashboardPath}*`, method: RequestMethod.GET })
      .apply(GlobalMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
