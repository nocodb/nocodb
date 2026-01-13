import { arrFlatMap } from './arrayHelpers';
import { NcErrorBase } from './error-handler';

type CircularRefType = {
  id: string;
  title: string;
  table?: string;
};
type CircularRefMapType = Map<string, CircularRefType>;

export class CircularRefContext {
  private constructor(existing?: CircularRefMapType) {
    if (existing?.size > 0) {
      this.refs = new Map<string, CircularRefType>(existing);
    }
  }

  refs: CircularRefMapType = new Map<string, CircularRefType>();
  static make(...existingArr: (CircularRefMapType | CircularRefContext)[]) {
    const existingRefs: CircularRefMapType[] = [];
    for (const existing of existingArr) {
      if (
        existing &&
        !(existing instanceof CircularRefContext) &&
        !(existing instanceof Map)
      ) {
        continue;
      }
      existingRefs.push(
        existing instanceof CircularRefContext ? existing.refs : existing
      );
    }

    // make immutable
    const result = new CircularRefContext(
      new Map(arrFlatMap(existingRefs.map((k) => [...k])))
    );
    return result;
  }

  add(ref: CircularRefType) {
    if (!ref) {
      return;
    }
    if (this.refs.has(ref.id)) {
      const [_root_id, root] = this.refs.entries().next().value;
      new NcErrorBase().formulaCircularRefError(
        `Detected circular ref for column '${this.formatRef(
          ref
        )}', when evaluate column '${this.formatRef(root)}'`
      );
    }
    this.refs.set(ref.id, ref);
  }

  cloneAndAdd(ref: CircularRefType) {
    const result = CircularRefContext.make(this);
    result.add(ref);
    return result;
  }

  formatRef(ref) {
    return `${ref.table ? ref.table + '.' : ''}${ref.title}`;
  }
}
