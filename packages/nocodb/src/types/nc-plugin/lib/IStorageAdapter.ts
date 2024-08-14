export default interface IStorageAdapter {
  init(): Promise<any>;
  fileCreate(destPath: string, file: XcFile): Promise<any>;
  fileDelete(filePath: string): Promise<any>;
  fileRead(filePath: string): Promise<any>;
  test(): Promise<boolean>;
}

interface XcFile {
  originalname: string;
  path: string;
  mimetype: string;
  size: number | string;
}

export { XcFile };
