export class NcSDKError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class BadRequest extends NcSDKError {}
