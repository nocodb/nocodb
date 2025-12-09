import { UITypes, TARGET_TABLES, TARGET_TABLES_META } from 'nocodb-sdk';
import { SyncSchema, SyncRecord, SyncValue } from './types';

export const SCHEMA_FILE_STORAGE: SyncSchema = {
  [TARGET_TABLES.FILE_STORAGE_FILE]: {
    title: TARGET_TABLES_META.fs_file.label,
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText },
      { title: 'File URL', uidt: UITypes.URL },
      { title: 'File Thumbnail URL', uidt: UITypes.URL },
      { title: 'Size', uidt: UITypes.Number },
      { title: 'Mime Type', uidt: UITypes.SingleLineText },
      { title: 'Description', uidt: UITypes.SingleLineText },
      { title: 'Checksum', uidt: UITypes.SingleLineText },
    ],
    relations: [],
  },
  [TARGET_TABLES.FILE_STORAGE_FOLDER]: {
    title: TARGET_TABLES_META.fs_folder.label,
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText },
      { title: 'Folder URL', uidt: UITypes.URL },
      { title: 'Size', uidt: UITypes.Number },
      { title: 'Description', uidt: UITypes.SingleLineText },
    ],
    relations: [
      {
        columnTitle: 'Files',
        relatedTable: TARGET_TABLES.FILE_STORAGE_FILE,
        relatedTableColumnTitle: 'Folder',
      },
      {
        columnTitle: 'Parent Folder',
        relatedTable: TARGET_TABLES.FILE_STORAGE_FOLDER,
        relatedTableColumnTitle: 'Folders',
      },
    ],
  },
};
