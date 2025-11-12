export class Profiler {
  protected constructor(protected info: { id: string }) {
    this.isEnabled = process.env.ENABLE_PROFILER === 'true';
    // TODO: add micromatch matching
    if (this.isEnabled) {
      console.time(info.id);
      console.timeLog(this.info.id, 'start');
    }
  }
  isEnabled = false;

  log(message?: string) {
    if (this.isEnabled) {
      console.timeLog(this.info.id, message);
    }
  }

  end() {
    if (this.isEnabled) {
      console.timeEnd(this.info.id);
    }
  }

  static start(id: string) {
    return new Profiler({ id: id });
  }
}
