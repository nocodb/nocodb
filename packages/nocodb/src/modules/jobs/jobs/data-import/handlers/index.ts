import type { DataImportHandler } from '~/modules/jobs/jobs/data-import/handlers/data-import-handler.interface';
import { CsvImportHandler } from '~/modules/jobs/jobs/data-import/handlers/csv-import.handler';
import { JsonImportHandler } from '~/modules/jobs/jobs/data-import/handlers/json-import.handler';
import { NcError } from '~/helpers/catchError';

const handlers: Record<string, DataImportHandler> = {
  csv: new CsvImportHandler(),
  json: new JsonImportHandler(),
};

export function getImportHandler(importType: string): DataImportHandler {
  const handler = handlers[importType];
  if (!handler) {
    NcError.badRequest(`Unsupported import type: ${importType}`);
  }
  return handler;
}
