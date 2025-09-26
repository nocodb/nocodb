import { arrFlatMap } from './arrayHelpers';
import { NcErrorBase } from './error-handler';

export class CircularRefContext {
  private constructor(existing?: Set<string>) {
    if (existing?.size > 0) {
      this.refs = new Set<string>(existing);
    }
  }

  refs: Set<string> = new Set<string>();
  static make(...existingArr: (Set<string> | CircularRefContext)[]) {
    const existingRefs: Set<string>[] = [];
    for (const existing of existingArr) {
      if (
        existing &&
        !(existing instanceof CircularRefContext) &&
        !(existing instanceof Set)
      ) {
        continue;
      }
      existingRefs.push(
        existing instanceof CircularRefContext ? existing.refs : existing
      );
    }

    // make immutable
    const result = new CircularRefContext(
      new Set(arrFlatMap(existingRefs.map((k) => [...k])))
    );
    return result;
  }

  add(ref: string) {
    if (this.refs.has(ref)) {
      const [root] = this.refs;
      new NcErrorBase().formulaCircularRefError(
        `Detected circular ref for column '${ref}', when evaluate column '${root}'`
      );
    }
    this.refs.add(ref);
  }

  cloneAndAdd(ref: string) {
    const result = CircularRefContext.make(this);
    result.add(ref);
    return result;
  }
}
