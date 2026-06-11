import { nanoid } from 'nanoid';
import { match } from 'minimatch';
export class Profiler {
  protected constructor(
    protected info: {
      id: string;
      suffix?: string;
    },
  ) {
    if (process.env.ENABLE_PROFILER) {
      for (const enableKey of process.env.ENABLE_PROFILER.split(',')) {
        if (enableKey === '*' && !info.id.startsWith('DEBUG:')) {
          this.isEnabled = true;
          break;
        } else if (match([info.id], process.env.ENABLE_PROFILER).length > 0) {
          this.isEnabled = true;
          break;
        }
      }
    }

    if (this.isEnabled) {
      console.time(this.getInfoId());
      console.timeLog(this.getInfoId(), 'start');
    }
  }

  getInfoId() {
    return [this.info.id, this.info.suffix].filter((k) => k).join('_');
  }
  isEnabled = false;

  log(message?: string) {
    if (this.isEnabled) {
      console.timeLog(this.getInfoId(), message);
    }
  }

  end() {
    if (this.isEnabled) {
      console.timeEnd(this.getInfoId());
    }
  }

  static start(id: string) {
    return new Profiler({ id: id, suffix: nanoid(3) });
  }
}
