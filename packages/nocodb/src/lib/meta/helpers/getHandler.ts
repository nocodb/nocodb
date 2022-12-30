import express from 'express';
import Noco from '../../Noco';

export default function getHandler(
  defaultHandler: express.Handler,
  eeHandler: express.Handler
): express.Handler {
  return async (...args) => {
    if (Noco.isEE()) {
      return defaultHandler(...args);
    }
    return eeHandler(...args);
  };
}
