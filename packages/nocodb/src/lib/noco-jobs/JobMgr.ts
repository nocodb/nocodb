export default abstract class JobMgr {
  protected completeCbks: Array<{
    [jobName: string]: (payload: any) => void;
  }> = [];
  protected failureCbks: Array<{
    [jobName: string]: (payload: any) => void;
  }> = [];
  protected progressCbks: Array<{
    [jobName: string]: (payload: any, msg?: string) => void;
  }> = [];

  public abstract add(jobName: string, payload: any): Promise<any>;
  // public abstract addCompleteCbk(jobName: string, cbk: (payload: any) => void);
  // public abstract addProgressCbk(
  //   jobName: string,
  //   cbk: (payload: any, progress: string) => void
  // );
  // public abstract addFailureCbk(
  //   jobName: string,
  //   cbk: (payload: any, progress: string) => void
  // );

  addCompleteCbk(jobName: string, cbk: (payload: any) => void) {
    this.completeCbks[jobName] = this.completeCbks[jobName] || [];
    this.completeCbks[jobName].push(cbk);
  }

  addFailureCbk(
    jobName: string,
    cbk: (payload: any, progress: string) => void
  ) {
    this.failureCbks[jobName] = this.failureCbks[jobName] || [];
    this.failureCbks[jobName].push(cbk);
  }
  addProgressCbk(
    jobName: string,
    cbk: (payload: any, progress: string) => void
  ) {
    this.progressCbks[jobName] = this.progressCbks[jobName] || [];
    this.progressCbks[jobName].push(cbk);
  }

  public abstract addJobWorker(
    jobName: string,
    workerFn: (
      payload: any,
      progressCbk?: (payload: any, msg?: string) => void
    ) => void
  );
}
