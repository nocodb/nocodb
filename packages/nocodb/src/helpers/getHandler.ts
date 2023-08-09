import type express from 'express';
import Noco from '~/Noco';

export default function getHandler(
  defaultHandler: express.Handler,
  eeHandler: express.Handler,
): express.Handler {
  return async (...args) => {
    if (Noco.isEE()) {
      return defaultHandler(...args);
    }
    return eeHandler(...args);
  };
}

export function getConditionalHandler<
  T extends (...args: any[]) => any,
  U extends (...args: any[]) => any,
>(
  defaultHandler: T,
  eeHandler: U,
): (
  ...args: Parameters<T> | Parameters<U>
) => Promise<ReturnType<T> | ReturnType<U>> {
  return async (...args: Parameters<T> | Parameters<U>) => {
    if (Noco.isEE()) {
      return defaultHandler(...args);
    }
    return eeHandler(...args);
  };
}
