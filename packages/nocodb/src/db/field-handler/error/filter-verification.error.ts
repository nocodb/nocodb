export class FilterVerificationError extends Error {
  constructor(readonly errors: string[]) {
    super(`Filter verification failed, errors: ${errors.join(', ')}`);
  }
}
