import { Logger } from '@nestjs/common';
import Emittery from 'emittery';
import type { IEventEmitter } from './event-emitter.interface';

export class FallbackEventEmitter implements IEventEmitter {
  private readonly emitter: Emittery;

  private readonly logger = new Logger(FallbackEventEmitter.name);

  constructor() {
    this.emitter = new Emittery();
  }

  emit(event: string, data: any): void {
    // `emit` is fire-and-forget (returns void), but `Emittery.emit` returns a
    // promise that rejects if ANY listener rejects (it does
    // `await Promise.all(listeners)`). Discarding that promise means a single
    // throwing listener — e.g. `checkLimit` raising `Forbidden` inside the
    // `HANDLE_WEBHOOK` handler — surfaces as an `unhandledRejection` that takes
    // the whole process down. Attach a catch so one misbehaving listener can
    // never crash the server; listeners that need their own error context still
    // wrap their own bodies.
    this.emitter.emit(event, data).catch((e) => {
      this.logger.error(
        `Unhandled error in '${event}' event listener: ${e?.message ?? e}`,
        e?.stack,
      );
    });
  }

  on(event: string, listener: (...args: any[]) => void) {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  removeListener(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  removeAllListeners(event?: string): void {
    this.emitter.clearListeners(event);
  }
}
