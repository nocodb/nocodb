export default class RequestQueue {
  private runningCount: number;
  private queue: any[];
  private maxParallelRequests: number;

  constructor(maxParallelRequests = 10) {
    this.maxParallelRequests = maxParallelRequests;
    this.queue = [];
    this.runningCount = 0;
  }

  async enqueue(requestFunction) {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.runningCount++;
        try {
          const result = await requestFunction();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.runningCount--;
          this.processQueue();
        }
      };

      if (this.runningCount < this.maxParallelRequests) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  processQueue() {
    if (this.runningCount < this.maxParallelRequests && this.queue.length > 0) {
      const nextRequest = this.queue.shift();
      nextRequest();
    }
  }
}
