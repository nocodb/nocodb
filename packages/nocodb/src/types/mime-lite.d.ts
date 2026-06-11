declare module 'mime/lite' {
  const mime: {
    getType(pathOrExtension: string): string | null;
    getExtension(mimeType: string): string | null;
    define(mimeMap: Record<string, string[]>, force?: boolean): void;
  };
  export default mime;
}
