# Google Drive Sync Integration

Sync Google Drive files and folders into the NocoDB file storage schema. The package extends the `SyncIntegration` base class and streams normalized records through `DataObjectStream`.

## Features

- **File storage schema coverage**: Populates `FILE_STORAGE_FILE` and `FILE_STORAGE_FOLDER` tables.
- **Page token-based incremental sync**: Uses Google Drive API page tokens to resume syncing from the last position.
- **Hierarchical folder structure**: Automatically links files to folders and folders to parent folders.
- **Batch-friendly streaming**: Streams data in batches of 25 records to keep memory usage low.
- **Complete file listing**: Syncs all files and folders from Google Drive, excluding trashed items.

## How It Works

1. Requires a Google Drive Auth integration (`@noco-integrations/google-drive-auth`) that provides an authenticated API client.
2. `fetchData()` initiates a file listing query starting from the root.
3. On the first run, it calls `/files` endpoint to get the initial page of file/folder entries.
4. On subsequent runs, it uses the stored `page_token` to fetch remaining entries.
5. The formatter processes entries, separating files and folders, and formats them according to the file storage schema.
6. Folders are processed first to ensure parent folders exist before files reference them.
7. Records are emitted through `DataObjectStream` until `null` is pushed to close the stream.

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled.
- Google Drive Auth integration configured with OAuth token.

### Sync Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this sync instance. |
| `config.authIntegrationId` | Reference to an existing Google Drive auth connection. |

### Required Google Drive Permissions

Grant the OAuth token the ability to read:

- `https://www.googleapis.com/auth/drive.readonly` – read file and folder metadata.
- `https://www.googleapis.com/auth/drive.metadata.readonly` – read file and folder metadata (minimal scope).

## Target Tables & Data Mapping

All data is written to the file storage schema exported by `@noco-integrations/core`.

### `FILE_STORAGE_FOLDER`

Fields populated by `GoogleDriveFormatter.formatEntries()`:

- `Name` – folder name
- `Folder URL` – web view link to the folder in Google Drive
- `Size` – null (folders don't have size)
- `Description` – null
- `RemoteRaw` – full folder JSON from Google Drive API
- `RemoteCreatedAt` – folder creation timestamp
- `RemoteUpdatedAt` – folder modification timestamp
- Links `Parent Folder` → parent folder `recordId` (if not root)

### `FILE_STORAGE_FILE`

Fields populated by `GoogleDriveFormatter.formatEntries()`:

- `Name` – file name
- `File URL` – web view link to the file in Google Drive
- `File Thumbnail URL` – thumbnail link if available
- `Size` – file size in bytes
- `Mime Type` – MIME type from Google Drive API
- `Checksum` – MD5 checksum from Google Drive
- `RemoteRaw` – full file JSON from Google Drive API
- `RemoteCreatedAt` – file creation timestamp
- `RemoteUpdatedAt` – file modification timestamp
- Links `Folder` → parent folder `recordId` (if not root)

## API Endpoints Used

- `GET /files` – list files and folders with pagination via `pageToken`

## Incremental Sync

- Uses Google Drive API page token-based pagination stored in `page_token` variable.
- On first run, starts from the first page and stores the page token.
- On subsequent runs, continues from the stored page token using the `pageToken` parameter.
- The page token is saved after each batch completes, allowing resumable syncs.
- The incremental key uses `RemoteUpdatedAt` for tracking updates.

## Error Handling & Limits

- Any error during fetching destroys the stream and surfaces the original exception.
- Google Drive API rate limits apply; stagger schedules for large accounts.
- Files and folders are processed in batches of 25 to manage memory usage.
- MIME type is provided directly by Google Drive API.

## Usage Example

```typescript
import { Integration, TARGET_TABLES } from '@noco-integrations/core';

const syncIntegration = await Integration.get(context, syncIntegrationId);
const authIntegration = await Integration.get(
  context,
  syncIntegration.getConfig().authIntegrationId,
);

const authWrapper = await authIntegration.getIntegrationWrapper();
const googleDriveAuth = await authWrapper.authenticate(); // GoogleDriveAuthIntegration

const syncWrapper = await syncIntegration.getIntegrationWrapper();

const stream = await syncWrapper.fetchData(googleDriveAuth, {
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
- Monitor Google Drive API usage to size batch schedules (current batch size = 25).
- Extend `GoogleDriveFormatter` if additional file storage fields are needed (for example, custom metadata or additional file properties).
