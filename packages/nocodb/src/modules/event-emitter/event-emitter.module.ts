import { Global, Module } from '@nestjs/common';
import { FallbackEventEmitter } from './fallback-event-emitter';

@Global()
@Module({
  providers: [
    {
      provide: 'IEventEmitter',
      useFactory: () => {
        return new FallbackEventEmitter();
      },
    },
  ],
  exports: ['IEventEmitter'],
})
export class EventEmitterModule {}
