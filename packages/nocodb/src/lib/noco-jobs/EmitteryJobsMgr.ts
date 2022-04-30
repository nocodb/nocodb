import JobMgr from './JobMgr';
import Emittery from 'emittery';

export default class EmitteryJobsMgr extends JobMgr {
  emitter: Emittery;

  constructor() {
    super();
    this.emitter = new Emittery();
  }

  add(jobName: string, payload: any): Promise<any> {
    return this.emitter.emit(jobName, payload);
  }

  addJobWorker(jobName: string, workerFn: (payload: any) => void) {
    this.emitter.on(jobName, payload => {});
  }
}
