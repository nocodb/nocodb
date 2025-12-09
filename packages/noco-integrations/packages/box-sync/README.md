# Box Sync Integration

Sync Box files and folders into the NocoDB file storage schema. The package extends the `SyncIntegration` base class and streams normalized records through `DataObjectStream`.

## Features

- **File storage schema coverage**: Populates `FILE_STORAGE_FILE` and `FILE_STORAGE_FOLDER` tables.
- **Stream position-based incremental sync**: Uses Box Events API stream positions to resume syncing from the last position.
- **Hierarchical folder structure**: Automatically links files to folders and folders to parent folders.
- **Batch-friendly streaming**: Streams data in batches of 25 records to keep memory usage low.
- **Event-based sync**: Syncs file and folder events (ITEM_UPLOAD, ITEM_CREATE) from Box Events API, excluding trashed and deleted items.

## How It Works

1. Requires a Box Auth integration (`@noco-integrations/box-auth`) that provides an authenticated API client.
2. `fetchData()` initiates an events query starting from the stored `stream_position`.
3. On the first run, it calls `/events` endpoint to get the initial page of file/folder events.
4. On subsequent runs, it uses the stored `stream_position` to fetch remaining events.
5. The formatter processes events, separating files and folders, and formats them according to the file storage schema.
6. Folders are processed first to ensure parent folders exist before files reference them.
7. Records are emitted through `DataObjectStream` until `null` is pushed to close the stream.

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled.
- Box Auth integration configured with OAuth token or API key.

### Sync Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this sync instance. |
| `config.authIntegrationId` | Reference to an existing Box auth connection. |

### Required Box Permissions

Grant the OAuth token or API key the ability to:

- Read file and folder metadata.
- Access Box Events API to track file and folder changes.

## Target Tables & Data Mapping

All data is written to the file storage schema exported by `@noco-integrations/core`.

### `FILE_STORAGE_FOLDER`

Fields populated by `BoxFormatter.formatEntries()`:

- `Name` – folder name
- `Folder URL` – web view link to the folder in Box (`https://app.box.com/folder/{id}`)
- `Size` – null (folders don't have size)
- `Description` – folder description if available
- `RemoteRaw` – full folder JSON from Box API
- `RemoteCreatedAt` – folder creation timestamp
- `RemoteUpdatedAt` – folder modification timestamp
- Links `Parent Folder` → parent folder `recordId` (if not root)

### `FILE_STORAGE_FILE`

Fields populated by `BoxFormatter.formatEntries()`:

- `Name` – file name
- `File URL` – web view link to the file in Box (`https://app.box.com/file/{id}`)
- `File Thumbnail URL` – null (not currently populated)
- `Size` – file size in bytes
- `Mime Type` – MIME type determined from file extension using `mime` package
- `Checksum` – SHA1 checksum from Box API
- `RemoteRaw` – full file JSON from Box API
- `RemoteCreatedAt` – file creation timestamp
- `RemoteUpdatedAt` – file modification timestamp
- Links `Folder` → parent folder `recordId` (if not root)

## API Endpoints Used

- `GET /events` – list file and folder events with pagination via `stream_position`

## Incremental Sync

- Uses Box Events API stream position-based pagination stored in `stream_position` variable.
- On first run, starts from the first page and stores the stream position.
- On subsequent runs, continues from the stored stream position using the `stream_position` parameter.
- The stream position is saved after each batch completes, allowing resumable syncs.
- The incremental key uses `RemoteUpdatedAt` for tracking updates.

## Error Handling & Limits

- Any error during fetching destroys the stream and surfaces the original exception.
- Box API rate limits apply (200 requests per minute per user); stagger schedules for large accounts.
- Files and folders are processed in batches of 25 to manage memory usage.
- MIME type is determined from file extension using the `mime` package, defaulting to `application/octet-stream` if not determinable.

## Usage Example

```typescript
import { Integration, TARGET_TABLES } from '@noco-integrations/core';

const syncIntegration = await Integration.get(context, syncIntegrationId);
const authIntegration = await Integration.get(
  context,
  syncIntegration.getConfig().authIntegrationId,
);

const authWrapper = await authIntegration.getIntegrationWrapper();
const boxAuth = await authWrapper.authenticate(); // BoxAuthIntegration

const syncWrapper = await syncIntegration.getIntegrationWrapper();

const stream = await syncWrapper.fetchData(boxAuth, {
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
- Monitor Box API usage to size batch schedules (current batch size = 25).
- Extend `BoxFormatter` if additional file storage fields are needed (for example, custom metadata or additional file properties).
