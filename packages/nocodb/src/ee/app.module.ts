import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppModule as AppCEModule, ceModuleConfig } from 'src/app.module';
import { LoggerModule } from 'nestjs-pino';
import { DbMuxController } from 'src/ee/controllers/db-mux.controller';
import { ThrottlerConfigService } from '~/services/throttler/throttler-config.service';
import appConfig from '~/app.config';
import { ExtractIdsMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import { ExecutionTimeCalculatorInterceptor } from '~/interceptors/execution-time-calculator/execution-time-calculator.interceptor';
import { UpdateStatsService } from '~/services/update-stats.service';
import { NcLogger } from '~/utils/logger/NcLogger';
import { generateUUID } from '~/helpers/uuidHelpers';

// todo: refactor to use config service
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

@Module({
  ...ceModuleConfig,
  imports: [
    ...ceModuleConfig.imports,
    ...(enableThrottler
      ? [
          ThrottlerModule.forRootAsync({
            useClass: ThrottlerConfigService,
            imports: [
              ConfigModule.forRoot({
                isGlobal: true,
                load: [() => appConfig],
              }),
            ],
          }),
        ]
      : []),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            clientId: req.headers?.['nc-client-id'],
          }),
        },
        // Define a custom request id function
        genReqId: function (req, res) {
          const existingID = req.id ?? req.headers['x-request-id'];
          if (existingID) return existingID;
          const id = generateUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
      },
    }),
  ],

  controllers: [DbMuxController],

  providers: [
    ...ceModuleConfig.providers.map((x) => {
      if (x && x['provide'] === APP_GUARD) {
        return {
          provide: APP_GUARD,
          useClass: ExtractIdsMiddleware,
          // useClass: enableThrottler
          //   ? CustomApiLimiterGuard
          //   : ExtractIdsMiddleware,
        };
      }
      return x;
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: ExecutionTimeCalculatorInterceptor,
    },
    UpdateStatsService,
    NcLogger,
  ],
  exports: [NcLogger],
})
export class AppModule extends AppCEModule {
  constructor() {
    super();
  }
}
