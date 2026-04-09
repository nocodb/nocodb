import { Logger } from '@nestjs/common';
import { getCircularReplacer } from 'nocodb-sdk';

const logger = new Logger('SerializeWorkerArgs');

/**
 * Serializes method arguments for safe transport through the job queue.
 *
 * - Primitives pass through unchanged.
 * - Objects are JSON-roundtripped (circular refs handled via getCircularReplacer).
 * - Functions throw immediately — they are never valid in a serialized job.
 *
 * @param args     The original arguments array
 * @param method   Method name (for log context)
 * @param service  Service name (for log context)
 */
export function serializeWorkerArgs(
  args: any[],
  method: string,
  service: string,
): any[] {
  return args.map((arg, index) => {
    if (typeof arg === 'function') {
      const msg = `Argument [${index}] of ${service}.${method} is a function — only JSON-serializable data is allowed in worker jobs`;
      logger.error(msg);
      throw new Error(msg);
    }

    if (arg == null) {
      return arg;
    }

    if (typeof arg === 'object') {
      try {
        return JSON.parse(JSON.stringify(arg, getCircularReplacer()));
      } catch (e) {
        logger.warn(
          `Argument [${index}] of ${service}.${method} failed serialization — replaced with undefined`,
        );
        return undefined;
      }
    }

    return arg;
  });
}
