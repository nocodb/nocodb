export default abstract class JobsMgr {
  protected successCbks: Array<{
    [jobName: string]: (payload: any) => void;
  }> = [];
  protected failureCbks: Array<{
    [jobName: string]: (payload: any, error: Error) => void;
  }> = [];
  protected progressCbks: Array<{
    [jobName: string]: (payload: any, msg?: string) => void;
  }> = [];

  public abstract add<T>(jobName: string, payload: T): Promise<any>;

  public abstract addJobWorker(
    jobName: string,
    workerFn: (
      payload: any,
      progressCbk?: (payload: any, msg?: string) => void,
    ) => void,
    options?: {
      onSuccess?: (payload: any) => void;
      onFailure?: (payload: any, errorData: any) => void;
      onProgress?: (payload: any, progressData: any) => void;
    },
  );

  addSuccessCbk(jobName: string, cbk: (payload: any) => void) {
    this.successCbks[jobName] = this.successCbks[jobName] || [];
    this.successCbks[jobName].push(cbk);
  }

  addFailureCbk(jobName: string, cbk: (payload: any, errorData: any) => void) {
    this.failureCbks[jobName] = this.failureCbks[jobName] || [];
    this.failureCbks[jobName].push(cbk);
  }
  addProgressCbk(
    jobName: string,
    cbk: (payload: any, progressData: any) => void,
  ) {
    this.progressCbks[jobName] = this.progressCbks[jobName] || [];
    this.progressCbks[jobName].push(cbk);
  }

  protected async invokeSuccessCbks(jobName: string, payload: any) {
    await Promise.all(
      this.successCbks?.[jobName]?.map((cb) => cb(payload)) || [],
    );
  }
  protected async invokeFailureCbks(
    jobName: string,
    payload: any,
    error?: Error,
  ) {
    await Promise.all(
      this.failureCbks?.[jobName]?.map((cb) => cb(payload, error)) || [],
    );
  }
  protected async invokeProgressCbks(
    jobName: string,
    payload: any,
    data?: any,
  ) {
    await Promise.all(
      this.progressCbks?.[jobName]?.map((cb) => cb(payload, data)) || [],
    );
  }
}
