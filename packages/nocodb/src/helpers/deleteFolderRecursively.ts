import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'fs';
import { join } from 'path';

export const deleteFolderRecursively = (directoryPath: string): void => {
  if (!existsSync(directoryPath)) return;

  const isRootDirectory = lstatSync(directoryPath).isDirectory();

  if (!isRootDirectory) {
    return unlinkSync(directoryPath);
  }

  const directoryFiles = readdirSync(directoryPath);

  directoryFiles.forEach((file) => {
    const currentFilePath = join(directoryPath, file);
    const isDirectory = lstatSync(currentFilePath).isDirectory();

    if (isDirectory) {
      deleteFolderRecursively(currentFilePath);
    } else {
      unlinkSync(currentFilePath);
    }
  });

  rmdirSync(directoryPath);
};
