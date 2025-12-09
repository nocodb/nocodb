import { UITypes, TARGET_TABLES, TARGET_TABLES_META } from 'nocodb-sdk';
import { SyncSchema, SyncRecord, SyncValue } from './types';

export const SCHEMA_FILE_STORAGE: SyncSchema = {
  [TARGET_TABLES.FILE_STORAGE_FILE]: {
    title: TARGET_TABLES_META.fs_file.label,
    columns: [
      { title: 'Name', uidt: UITypes.SingleLineText },
      { title: 'File URL', uidt: UITypes.SingleLineText },
      { title: 'File Thumbnail URL', uidt: UITypes.SingleLineText },
      { title: 'Size', uidt: UITypes.Number },
      { title: 'Mime Type', uidt: UITypes.SingleLineText },
      { title: 'Description', uidt: UITypes.SingleLineText },
      { title: 'Folder', uidt: UITypes.LinkToAnotherRecord },
      { title: 'Checksum', uidt: UITypes.SingleLineText },
      { title: 'Permissions', uidt: UITypes.JSON },
      { title: 'Drive', uidt: UITypes.LinkToAnotherRecord },
      { title: 'Remote Data', uidt: UITypes.JSON },
    ],
    relations: [],
  },
  [TARGET_TABLES.FILE_STORAGE_FOLDER]: {
    title: TARGET_TABLES_META.fs_folder.label,
    columns: [
      { title: 'Remote ID', uidt: UITypes.SingleLineText },
      { title: 'Created At', uidt: UITypes.DateTime },
      { title: 'Modified At', uidt: UITypes.DateTime },
      { title: 'Name', uidt: UITypes.SingleLineText },
      { title: 'Folder URL', uidt: UITypes.SingleLineText },
      { title: 'Size', uidt: UITypes.Number },
      { title: 'Description', uidt: UITypes.SingleLineText },
      { title: 'Parent Folder', uidt: UITypes.LinkToAnotherRecord },
      { title: 'Drive', uidt: UITypes.LinkToAnotherRecord },
      { title: 'Permissions', uidt: UITypes.JSON },
      { title: 'Remote Created At', uidt: UITypes.DateTime },
      { title: 'Remote Updated At', uidt: UITypes.DateTime },
      { title: 'Remote Data', uidt: UITypes.JSON },
    ],
    relations: [
      {
        columnTitle: 'Files',
        relatedTable: TARGET_TABLES.FILE_STORAGE_FILE,
        relatedTableColumnTitle: 'Folder',
      },
    ],
  },
};
