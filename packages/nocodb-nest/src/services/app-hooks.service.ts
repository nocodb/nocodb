import { Injectable } from '@nestjs/common';

// todo: move to nocodb-sdk
export enum AppEvents {
  PROJECT_CREATED = 'PROJECT_CREATED',
  PROJECT_INVITE = 'PROJECT_INVITE',
  WELCOME = 'WELCOME',
  WORKSPACE_CREATED = 'WORKSPACE_CREATED',
  WORKSPACE_INVITE = 'WORKSPACE_INVITE',
}

@Injectable()
export class AppHooksService {
  private listeners = new Map<string, ((...args: any[]) => void)[]>();
  private allListeners: ((...args: any[]) => void)[] = [];

  on(event: AppEvents, listener: (...args: any[]) => void) {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  emit(event: AppEvents, ...args: any[]) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach((listener) => listener(...args));
    this.allListeners.forEach((listener) => listener(event, ...args));
  }

  removeListener(event: AppEvents, listener: (...args: any[]) => void) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  removeAllListeners(event: AppEvents) {
    this.listeners.delete(event);
  }

  onAll(listener: (event: AppEvents, ...args: any[]) => void) {
    this.allListeners.push(listener);
  }

  removeAllListener(listener: (...args: any[]) => void) {
    const allIndex = this.allListeners.indexOf(listener);
    if (allIndex > -1) {
      this.allListeners.splice(allIndex, 1);
    }
  }
}
