import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { IEventEmitter } from './event-emitter.interface';

export class NestjsEventEmitter implements IEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(event: string, data: any): void {
    this.eventEmitter.emit(event, data);
  }

  on(event: string, listener: (...args: any[]) => void) {
    this.eventEmitter.on(event, listener);
    return () => this.eventEmitter.removeListener(event, listener);
  }

  removeListener(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.removeListener(event, listener);
  }

  removeAllListeners(event?: string): void {
    this.eventEmitter.removeAllListeners(event);
  }
}
