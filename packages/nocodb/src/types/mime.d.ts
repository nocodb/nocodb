declare module 'mime/lite' {
  interface Mime {
    getType(path: string): string | null;
    getExtension(mimeType: string): string | null;
  }
  
  const mime: Mime;
  export default mime;
}

