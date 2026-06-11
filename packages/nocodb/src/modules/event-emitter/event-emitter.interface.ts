export interface IEventEmitter {
  emit(event: string, arg: any): void;
  on(event: string, listener: (arg: any) => void): () => void;
  removeListener(event: string, listener: (arg: any) => void): void;
  removeAllListeners(event?: string): void;
}
