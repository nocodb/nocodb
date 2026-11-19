// The package entry's typings reference the DOM lib, which would retype Node's
// streams and Buffer across the backend.
declare module '@xmldom/xmldom/lib/dom-parser' {
  type ErrorHandler = (message: string) => void;

  export class DOMParser {
    constructor(options?: {
      errorHandler?: {
        warning?: ErrorHandler;
        error?: ErrorHandler;
        fatalError?: ErrorHandler;
      };
    });
    parseFromString(
      source: string,
      mimeType: string,
    ): { documentElement?: { localName?: string } | null } | undefined;
  }
}
