# Dropbox Sync Integration

Sync Dropbox files and folders into the NocoDB file storage schema. The package extends the `SyncIntegration` base class and streams normalized records through `DataObjectStream`.

## Features

- **File storage schema coverage**: Populates `FILE_STORAGE_FILE` and `FILE_STORAGE_FOLDER` tables.
- **Cursor-based incremental sync**: Uses Dropbox API cursors to resume syncing from the last position.
- **Hierarchical folder structure**: Automatically links files to folders and folders to parent folders.
- **Batch-friendly streaming**: Streams data in batches of 25 records to keep memory usage low.
- **Recursive file listing**: Syncs all files and folders recursively from the Dropbox root.

## How It Works

1. Requires a Dropbox Auth integration (`@noco-integrations/dropbox-auth`) that provides an authenticated API client.
2. `fetchData()` initiates a recursive folder listing starting from the root path (`''`).
3. On the first run, it calls `/files/list_folder` to get the initial cursor and file/folder entries.
4. On subsequent runs, it uses the stored cursor to call `/files/list_folder/continue` to fetch remaining entries.
5. The formatter processes entries, separating files and folders, and formats them according to the file storage schema.
6. Folders are processed first to ensure parent folders exist before files reference them.
7. Records are emitted through `DataObjectStream` until `null` is pushed to close the stream.

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled.
- Dropbox Auth integration configured with OAuth token or API key.

### Sync Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this sync instance. |
| `config.authIntegrationId` | Reference to an existing Dropbox auth connection. |

### Required Dropbox Permissions

Grant the OAuth token or API key the ability to read:

- `files.content.read` – read file contents.
- `files.metadata.read` – read file and folder metadata.

## Target Tables & Data Mapping

All data is written to the file storage schema exported by `@noco-integrations/core`.

### `FILE_STORAGE_FOLDER`

Fields populated by `DropboxFormatter.formatEntries()`:

- `Name` – folder name
- `Folder URL` – full path display (e.g., `/folder1/folder2`)
- `Size` – null (folders don't have size)
- `Description` – null
- `RemoteRaw` – full folder JSON from Dropbox API
- `RemoteCreatedAt` – null
- `RemoteUpdatedAt` – null
- Links `Parent Folder` → parent folder `recordId` (if not root)

### `FILE_STORAGE_FILE`

Fields populated by `DropboxFormatter.formatEntries()`:

- `Name` – file name
- `File URL` – full path display (e.g., `/folder/file.txt`)
- `File Thumbnail URL` – null
- `Size` – file size in bytes
- `Mime Type` – detected MIME type based on file extension
- `Checksum` – content hash from Dropbox
- `RemoteRaw` – full file JSON from Dropbox API
- `RemoteCreatedAt` – client modification timestamp
- `RemoteUpdatedAt` – server modification timestamp
- Links `Folder` → parent folder `recordId` (if not root)

## API Endpoints Used

- `POST /files/list_folder` – initial folder listing with recursive option
- `POST /files/list_folder/continue` – continue listing with cursor

## Incremental Sync

- Uses Dropbox API cursor-based pagination stored in `file_cursor` variable.
- On first run, starts from root path and stores the initial cursor.
- On subsequent runs, continues from the stored cursor using `/files/list_folder/continue`.
- The cursor is saved after each batch completes, allowing resumable syncs.
- The incremental key uses `RemoteUpdatedAt` for tracking updates.

## Error Handling & Limits

- Any error during fetching destroys the stream and surfaces the original exception.
- Dropbox API rate limits apply; stagger schedules for large accounts.
- Files and folders are processed in batches of 25 to manage memory usage.
- MIME type detection falls back to `application/octet-stream` if detection fails.

## Usage Example

```typescript
import { Integration, TARGET_TABLES } from '@noco-integrations/core';

const syncIntegration = await Integration.get(context, syncIntegrationId);
const authIntegration = await Integration.get(
  context,
  syncIntegration.getConfig().authIntegrationId,
);

const authWrapper = await authIntegration.getIntegrationWrapper();
const dropboxAuth = await authWrapper.authenticate(); // DropboxAuthIntegration

const syncWrapper = await syncIntegration.getIntegrationWrapper();

const stream = await syncWrapper.fetchData(dropboxAuth, {
  targetTables: [
    TARGET_TABLES.FILE_STORAGE_FILE,
    TARGET_TABLES.FILE_STORAGE_FOLDER,
  ],
});

for await (const record of stream) {
  console.log(record.targetTable, record.data);
}
```

## Next Steps

- Pair this integration with automations or workflows that process the file storage tables.
- Monitor Dropbox API usage to size batch schedules (current batch size = 25).
- Extend `DropboxFormatter` if additional file storage fields are needed (for example, thumbnail URLs or custom metadata).
