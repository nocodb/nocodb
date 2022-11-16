export default interface IStorageAdapter {
  init(): Promise<any>;
  fileCreate(destPath: string, file: XcFile, isPublic?: boolean): Promise<any>;
  fileDelete(filePath: string): Promise<any>;
  fileRead(filePath: string): Promise<any>;
  test(): Promise<boolean>;
  fileWrite?({ location, fileName, content, contentType }): Promise<any>;
}

interface XcFile {
  originalname: string;
  path: string;
  mimetype: string;
  size: number | string;
  buffer?: any;
}

export { XcFile };
