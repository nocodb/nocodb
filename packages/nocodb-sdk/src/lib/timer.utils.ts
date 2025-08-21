type HandlerType = (timer: Timer) => Promise<void>;
export class Timer {
  private constructor({
    handler,
    time,
    errorHandler,
  }: {
    handler: HandlerType;
    time: number;
    errorHandler?: (ex: Error) => void;
  }) {
    this.handler = handler;
    this.time = time;
    this.errorHandler = errorHandler;
  }
  errorHandler?: (ex: Error) => void;
  handler: HandlerType;
  time: number;

  static start(
    handler: HandlerType,
    time: number,
    { errorHandler }: { errorHandler?: (ex: Error) => void } = {}
  ) {
    if (time <= 0) {
      throw new Error(`Timer time need to be above 0`);
    }
    const timer = new Timer({ handler, time, errorHandler });
    timer.start();
    return timer;
  }

  timeoutHandle: NodeJS.Timeout;
  start() {
    this.timeoutHandle = setTimeout(async () => {
      try {
        await this.handler(this);
      } catch (ex) {
        this.errorHandler?.(ex);
      }
    }, this.time);
  }
  stop() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }
}
