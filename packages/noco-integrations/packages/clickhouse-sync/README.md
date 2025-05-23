# ClickHouse Sync Integration

This package provides a sync integration for ClickHouse databases in NocoDB.

## Features

- **Database Discovery**: Automatically discover available databases in your ClickHouse instance
- **Table Selection**: Choose specific tables to sync from your selected database
- **Schema Detection**: Automatically detect column types and primary keys
- **Type Mapping**: Intelligent mapping of ClickHouse data types to NocoDB field types
- **Incremental Sync**: Support for incremental data synchronization based on timestamp or ID fields

## Supported ClickHouse Data Types

The integration automatically maps ClickHouse data types to appropriate NocoDB field types:

### Numeric Types
- **Integer types**: `UInt8`, `UInt16`, `UInt32`, `UInt64`, `Int8`, `Int16`, `Int32`, `Int64` → Number
- **Float types**: `Float32`, `Float64`, `Double` → Decimal
- **Decimal types**: `Decimal(P,S)` → Decimal

### String Types
- **String types**: `String`, `FixedString(N)` → Single Line Text
- **UUID**: `UUID` → Single Line Text

### Date/Time Types
- **Date types**: `Date`, `Date32` → Date
- **DateTime types**: `DateTime`, `DateTime64` → DateTime

### Other Types
- **Boolean**: `Bool`, `Boolean` → Checkbox
- **Array types**: `Array(T)` → JSON
- **JSON**: `JSON` → JSON
- **IP types**: `IPv4`, `IPv6` → Single Line Text
- **Nullable types**: Automatically handled for all supported types

## Configuration

The integration requires:

1. **ClickHouse Connection**: Select a configured ClickHouse authentication integration
2. **Database**: Choose the database to sync from
3. **Tables**: Select one or more tables to include in the sync

## Primary Key Detection

The integration automatically detects primary keys from ClickHouse table metadata. Primary keys are essential for:
- Generating unique record identifiers
- Supporting incremental sync operations
- Maintaining data consistency

## Incremental Sync

The integration supports incremental synchronization by automatically detecting suitable columns:
- `updated_at`, `created_at`, `timestamp` (DateTime fields)
- `id` (Numeric fields)

## Dependencies

- `@noco-integrations/core`: Core integration framework
- `@noco-integrations/clickhouse-auth`: ClickHouse authentication integration
- `@clickhouse/client`: Official ClickHouse client for Node.js

## Usage

This integration is designed to be used within the NocoDB integration framework. It cannot be used standalone.

## Version

Current version: 0.1.0 