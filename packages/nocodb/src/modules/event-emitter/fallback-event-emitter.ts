import Emittery from 'emittery';
import type { IEventEmitter } from './event-emitter.interface';

export class FallbackEventEmitter implements IEventEmitter {
  private readonly emitter: Emittery;

  constructor() {
    this.emitter = new Emittery();
  }

  emit(event: string, data: any): void {
    this.emitter.emit(event, data);
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
