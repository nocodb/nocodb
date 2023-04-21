import { Injectable } from '@nestjs/common';

@Injectable()
export class AppHooksService {
  // eslint-disable-next-line @typescript-eslint/ban-types
  private listeners = new Map<string, Function[]>();

  // eslint-disable-next-line @typescript-eslint/ban-types
  on(event: string, listener: Function) {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((listener) => listener(...args));
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  removeListener(event: string, listener: Function) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  removeAllListeners(event: string) {
    this.listeners.delete(event);
  }
}
