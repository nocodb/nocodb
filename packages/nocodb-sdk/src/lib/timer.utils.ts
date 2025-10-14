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
    // set time default as 1 minute
    time: number = 60 * 1000,
    { errorHandler }: { errorHandler?: (ex: Error) => void } = {}
  ) {
    if (time <= 0) {
      // if time invalid, set it to 1 minute
      time = 60 * 1000;
    }
    const timer = new Timer({ handler, time, errorHandler });
    timer.start();
    return timer;
  }

  timeoutHandle: any;
  start() {
    this.timeoutHandle = setTimeout(async () => {
      try {
        await this.handler(this);
      } catch (ex) {
        this.errorHandler?.(ex);
      }
    }, this.time);

    // Safe unref call
    // need to do this because the typescript is not specific for node, and unref is node-specific
    if (
      this.timeoutHandle &&
      typeof this.timeoutHandle === 'object' &&
      'unref' in this.timeoutHandle
    ) {
      (this.timeoutHandle as any).unref();
    }
  }
  stop() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }
}
