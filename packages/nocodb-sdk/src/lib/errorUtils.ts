import { NcErrorType } from './globals';

export class NcSDKError extends Error {
  constructor(message: string) {
    super(message);
  }
}
export interface NcSDKErrorV2Info {
  message: string;
  error: NcErrorType;
  getStatus?: () => number;
}
export class NcSDKErrorV2 extends Error {
  constructor(info: NcSDKErrorV2Info) {
    super(info.message);
    this.getStatus = info.getStatus;
    this.errorType = info.error;
  }
  info: NcSDKErrorV2Info;
  getStatus?: () => number;
  errorType: NcErrorType;
}

export class BadRequest extends NcSDKError {}
