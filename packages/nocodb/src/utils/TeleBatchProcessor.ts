import axios from 'axios';

// This class is used to batch process telemetry data
class TeleBatchProcessor {
  private batch: any[];
  private flushAt: number;
  private flushInterval: number;
  private timeoutRef: any;

  constructor({ flushAt = 100, flushInterval = 10000 } = {}) {
    this.batch = [];
    this.flushAt = flushAt;
    this.flushInterval = flushInterval;
  }

  capture(item: Record<string, any>) {
    this.batch.push(item);

    if (this.batch.length >= this.flushAt) {
      this.flushBackground();
    }

    if (this.flushInterval) {
      this.timeoutRef = setTimeout(() => {
        this.flushBackground();
      }, this.flushInterval);
    }
  }

  flushBackground() {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = null;
    }
    this.flush().catch(() => {
      // do nothing
    });
  }

  async flush() {
    const batch = this.batch.splice(0, this.batch.length);
    if (!batch.length) {
      return;
    }

    await axios.post('https://telemetry.nocodb.com/api/v1/telemetry', batch);
  }
}

export default TeleBatchProcessor;
