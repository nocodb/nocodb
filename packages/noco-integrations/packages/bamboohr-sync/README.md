# BambooHR Sync Integration

Sync BambooHR employee, location, and employment data into the NocoDB HRIS schema. The package extends the `SyncIntegration` base class and streams normalized records through `DataObjectStream`.

## Features

- **HRIS schema coverage**: Populates `HRIS_EMPLOYEE`, `HRIS_LOCATION`, and `HRIS_EMPLOYMENT` tables.
- **Incremental sync**: Uses BambooHR `lastChanged` timestamps so subsequent runs only fetch updates.
- **Linked records**: Automatically links locations to employees and employment rows back to employees.
- **Batch-friendly streaming**: Streams data in batches of 25 records to keep memory usage low.
- **Namespace isolation**: Stores the BambooHR company domain in `RemoteNamespace` for multi-domain datasets.

## How It Works

1. Requires a BambooHR Auth integration (`@noco-integrations/bamboohr-auth`) that yields an Axios client with the company domain and API key.
2. `fetchData()` inspects `targetTables` and `targetTableIncrementalValues` to decide which tables to sync and which `since` cursor (`lastChanged`) to pass per table.
3. Employees are pulled via `/employees/changed`; each employee detail is fetched with the required field list and formatted twice (employee + location records).
4. Employment rows are produced by fetching `/employees/changed/tables/compensation` and `/employees/changed/tables/jobInfo`, hydrating any missing employee details from cache, and combining the latest job and compensation entries.
5. Records are emitted through `DataObjectStream` until `null` is pushed to close the stream.

## Configuration

### Prerequisites

- NocoDB instance with the integrations framework enabled.
- BambooHR Auth integration configured with company domain and API key.

### Sync Form Fields

| Field | Description |
| --- | --- |
| `title` | Display name for this sync instance. |
| `config.authIntegrationId` | Reference to an existing BambooHR auth connection. |

### Required BambooHR Permissions

Grant the API key (or OAuth token) the ability to read:

- `employees` – employee directory data.
- `jobInfo` – job titles, departments, employment history.
- `compensation` – base pay and overtime compensation tables.

## Target Tables & Data Mapping

All data is written to the HRIS schema exported by `@noco-integrations/core`.

### `HRIS_EMPLOYEE`

Fields populated by `BambooHRFormatter.formatEmployee()`:

- `Employee Number`, `First Name`, `Last Name`, `Preferred Name`, `Display Full Name`
- `Work Email`, `Personal Email`, `Mobile Phone Number`
- `Employment Status`, `SSN`, `Gender`, `Ethnicity`, `Marital Status`
- `Date Of Birth`, `Start Date`, `Termination Date`
- `Manager`, `Department`, `Avatar`
- `RemoteRaw` (full employee JSON), `RemoteUpdatedAt`, `RemoteNamespace`

### `HRIS_LOCATION`

Derived from the same employee detail via `formatHomeLocation()`:

- `Name`, `Phone Number`, `Street 1`, `Street 2`, `City`, `State`, `Zip Code`, `Country`, `Location Type` (`Home`)
- Links `Home of Employee` → employee `recordId`

### `HRIS_EMPLOYMENT`

Built by `formatEmployment()` combining the latest jobInfo + compensation rows:

- `Employment Type`, `Job Title`, `Pay Rate`, `Pay Period`, `Pay Currency`, `Flsa Status`, `Effective Date`
- Reserved placeholders for `Pay Frequency` and `Pay Group`
- `RemoteRaw` (job info JSON), `RemoteUpdatedAt`, `RemoteNamespace`
- Link `Employee` → employee `recordId`

## API Endpoints Used

- `GET /employees/changed?since={timestamp}`
- `GET /employees/{id}?fields={employeeFetchFields}`
- `GET /employees/changed/tables/compensation?since={timestamp}`
- `GET /employees/changed/tables/jobInfo?since={timestamp}`
- `GET /employees/{id}/tables/compensation`

## Incremental Sync

- Employee and location tables rely on the `lastChanged` cursor returned by `/employees/changed`.
- Employment rows derive their cursor from the same `lastChanged` value returned in jobInfo/compensation feeds.
- Each emitted record stores the cursor in `RemoteUpdatedAt`, so subsequent runs reuse it via `getIncrementalKey()`.
- Deleted employees currently emit no tombstones (`deleted` actions are skipped).

## Error Handling & Limits

- Axios `404` responses for missing employees are swallowed so bad references do not terminate the sync.
- Any other error destroys the stream and surfaces the original exception.
- Compensation `rate` and `overtimeRate` values are normalized into `<value> <currency>` strings before mapping.
- Employment `Pay Rate` gracefully drops invalid numeric strings.
- BambooHR API rate limits still apply; stagger schedules for large tenants.

## Usage Example

```typescript
import { Integration, TARGET_TABLES } from '@noco-integrations/core';

const syncIntegration = await Integration.get(context, syncIntegrationId);
const authIntegration = await Integration.get(
  context,
  syncIntegration.getConfig().authIntegrationId,
);

const authWrapper = await authIntegration.getIntegrationWrapper();
const bamboohrAuth = await authWrapper.authenticate(); // Axios client

const syncWrapper = await syncIntegration.getIntegrationWrapper();

const stream = await syncWrapper.fetchData(bamboohrAuth, {
  targetTables: [
    TARGET_TABLES.HRIS_EMPLOYEE,
    TARGET_TABLES.HRIS_LOCATION,
    TARGET_TABLES.HRIS_EMPLOYMENT,
  ],
});

for await (const record of stream) {
  console.log(record.targetTable, record.data);
}
```

## Next Steps

- Pair this integration with automations or workflows that ingest the HRIS tables.
- Monitor BambooHR API usage to size batch schedules (current batch size = 25).
- Extend `BambooHRFormatter` if additional HRIS fields are needed (for example, cost centers or custom fields).
