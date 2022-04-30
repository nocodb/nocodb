import JobsMgr from './JobsMgr';
import Emittery from 'emittery';

export default class EmitteryJobsMgr extends JobsMgr {
  emitter: Emittery;

  constructor() {
    super();
    this.emitter = new Emittery();
  }

  add(jobName: string, payload: any): Promise<any> {
    return this.emitter.emit(jobName, payload);
  }

  addJobWorker(
    jobName: string,
    workerFn: (
      payload: any,
      progressCbk?: (payload: any, msg?: string) => void
    ) => void
  ) {
    this.emitter.on(jobName, async payload => {
      try {
        await workerFn(payload, (...args) =>
          this.invokeProgressCbks(jobName, ...args)
        );
        await this.invokeFailureCbks(jobName, payload);
      } catch (e) {
        await this.invokeFailureCbks(jobName, payload);
      }
    });
  }
}
