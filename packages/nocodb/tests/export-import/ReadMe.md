# Export-Import Testing

This directory contains tools and configurations for testing the export and import functionality of NocoDB bases.

## Overview

The export-import feature allows you to:

- Export base schemas and data from one NocoDB instance
- Import them into another NocoDB instance or create a new base
- Test migration scenarios and backup/restore workflows

## Configuration

Create a `config.json` file with the following structure:

```json
{
    "srcProject": "sample",
    "dstProject": "sample-copy",
    "baseURL": "http://localhost:8080",
    "xc-auth": "Copy Auth Token"
}
```

### Configuration Parameters

- **baseURL**: The URL of your NocoDB instance (common for both import & export)
- **xc-auth**: Your authentication token (common for both import & export)
- **srcProject**: Source base name for export or JSON file name for import
- **dstProject**: Destination base name for import

## Export Process

The export process creates a JSON file containing the base schema and structure.

### Export Configuration

- **srcProject**: Specify the source base name to be exported
- The export will create a JSON file named `{srcProject}.json`

### Running Export

```bash
cd packages/nocodb/tests/export-import
node exportSchema.js
```

## Import Process

The import process creates a new base from an exported JSON file.

### Import Configuration

- **srcProject**: Specify the JSON file name to be imported (without .json extension)
- **dstProject**: Specify the new base name to be created

### Data Import Behavior

- **Schema**: Always imported from the JSON file
- **Data**: Imported only if the `srcProject` base exists in the current NocoDB instance
- **Note**: Data import is not sourced from the exported JSON file, but from the live base

### Running Import

```bash
cd packages/nocodb/tests/export-import
node importSchema.js
```

## Prerequisites

1. **NocoDB Instance**: Ensure your NocoDB instance is running
2. **Authentication**: Valid auth token with appropriate permissions
3. **Base Access**: Ensure the source base exists and is accessible
4. **Node.js**: Node.js environment to run the scripts

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your `xc-auth` token is valid and not expired
   - Ensure the token has appropriate permissions for the base

2. **Base Not Found**
   - Check that the `srcProject` base name is correct
   - Verify the base exists in your NocoDB instance

3. **Network Issues**
   - Confirm the `baseURL` is accessible
   - Check for firewall or network connectivity issues

4. **Permission Errors**
   - Ensure your user has export/import permissions
   - Verify base-level access rights

### Getting Help

If you encounter issues:

1. Check the console output for detailed error messages
2. Verify your configuration parameters
3. Test the connection to your NocoDB instance
4. Review the NocoDB logs for additional details

## File Structure

```text
export-import/
├── config.json           # Configuration file
├── exportSchema.js       # Export script
├── importSchema.js       # Import script
└── ReadMe.md            # This documentation
```
