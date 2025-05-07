import { Injectable, Logger } from '@nestjs/common';
import { parse } from 'papaparse';
import { UITypes } from 'nocodb-sdk';
import { JobsLogService } from '../jobs-log.service';
import { CsvImportJobData } from '~/interface/Jobs';
import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { sanitizeColumnName } from '~/helpers';
import { Model, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { ViewsService } from '~/services/views.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { GridsService } from '~/services/grids.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { FormsService } from '~/services/forms.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { GalleriesService } from '~/services/galleries.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { detectColumnType, getPossibleUidt } from './helpers/column-type-detector';

@Injectable()
export class CsvImportProcessor {
  private readonly logger = new Logger(CsvImportProcessor.name);

  constructor(
    private readonly jobsLogService: JobsLogService,
    private readonly tablesService: TablesService,
    private readonly columnsService: ColumnsService,
    private readonly bulkDataService: BulkDataAliasService,
    private readonly viewsService: ViewsService,
    private readonly viewColumnsService: ViewColumnsService,
    private readonly gridsService: GridsService,
    private readonly gridColumnsService: GridColumnsService,
    private readonly formsService: FormsService,
    private readonly formColumnsService: FormColumnsService,
    private readonly galleriesService: GalleriesService,
    private readonly filtersService: FiltersService,
    private readonly sortsService: SortsService,
  ) {}

  async process(job: any) {
    const data = job.data as CsvImportJobData;
    const { baseId, sourceId, modelId, csvData, columnMapping, options } = data;

    try {
      this.logger.log(`Starting CSV import job for base ${baseId}`);
      await this.jobsLogService.log(job, `Starting CSV import`);

      // Parse CSV data
      let parsedData: any[];
      let headers: string[];

      if (typeof csvData === 'string') {
        // Parse CSV string
        const parseResult = parse(csvData, {
          header: options.firstRowAsHeaders,
          skipEmptyLines: true,
          delimiter: options.delimiter,
          encoding: options.encoding,
        });
        
        parsedData = parseResult.data;
        headers = options.firstRowAsHeaders ? parseResult.meta.fields : 
          parsedData[0] ? Object.keys(parsedData[0]).map((_, i) => `field_${i + 1}`) : [];
      } else {
        // Handle file or URL
        // This would need to be implemented based on how files are stored
        throw new Error('File or URL import not implemented yet');
      }

      await this.jobsLogService.log(job, `Parsed ${parsedData.length} rows from CSV`);

      if (options.createNewTable) {
        // Create a new table
        return await this.importToNewTable(
          job,
          baseId,
          sourceId,
          parsedData,
          headers,
          columnMapping,
          options
        );
      } else {
        // Import to existing table
        return await this.importToExistingTable(
          job,
          baseId,
          sourceId,
          modelId,
          parsedData,
          headers,
          columnMapping,
          options
        );
      }
    } catch (error) {
      this.logger.error(`Error in CSV import job: ${error.message}`, error.stack);
      await this.jobsLogService.log(job, `Error: ${error.message}`);
      throw error;
    }
  }

  private async importToNewTable(
    job: any,
    baseId: string,
    sourceId: string,
    parsedData: any[],
    headers: string[],
    columnMapping: Record<string, string>,
    options: any
  ) {
    await this.jobsLogService.log(job, `Creating new table for CSV import`);

    // Get source
    const source = await Source.get(sourceId);

    // Create table
    const tableName = options.tableName || 'csv_import_table';
    const sanitizedTableName = sanitizeColumnName(tableName);

    // Detect column types from the first 100 rows
    const sampleData = parsedData.slice(0, 100);
    const columnTypes: Record<string, Record<string, number>> = {};
    
    // Initialize column types
    headers.forEach(header => {
      columnTypes[header] = {};
    });

    // Detect column types
    sampleData.forEach(row => {
      headers.forEach(header => {
        const value = row[header];
        if (value !== null && value !== undefined) {
          const uidt = detectColumnType(value);
          columnTypes[header][uidt] = (columnTypes[header][uidt] || 0) + 1;
        }
      });
    });

    // Create table
    const table = await this.tablesService.tableCreate({
      baseId,
      sourceId,
      table_name: sanitizedTableName,
      title: tableName,
      columns: headers.map(header => {
        const mappedName = columnMapping[header] || header;
        const sanitizedColumnName = sanitizeColumnName(mappedName);
        const uidt = getPossibleUidt(columnTypes[header]);
        
        return {
          column_name: sanitizedColumnName,
          title: mappedName,
          uidt,
        };
      }),
    }, { user: data.user });

    await this.jobsLogService.log(job, `Created table ${tableName}`);

    // Create default views
    await this.createDefaultViews(table);

    // Insert data
    if (parsedData.length > 0) {
      await this.jobsLogService.log(job, `Inserting ${parsedData.length} rows`);
      
      // Map data to match column names
      const mappedData = parsedData.map(row => {
        const mappedRow: Record<string, any> = {};
        headers.forEach(header => {
          const mappedName = columnMapping[header] || header;
          const sanitizedColumnName = sanitizeColumnName(mappedName);
          mappedRow[sanitizedColumnName] = row[header];
        });
        return mappedRow;
      });

      // Insert data in batches of 100
      const batchSize = 100;
      for (let i = 0; i < mappedData.length; i += batchSize) {
        const batch = mappedData.slice(i, i + batchSize);
        await this.bulkDataService.bulkDataInsert({
          baseId,
          sourceId,
          modelId: table.id,
          body: batch,
        }, { user: data.user });
        
        await this.jobsLogService.log(job, `Inserted rows ${i + 1} to ${Math.min(i + batchSize, mappedData.length)}`);
      }
    }

    await this.jobsLogService.log(job, `CSV import completed successfully`);
    return { table };
  }

  private async importToExistingTable(
    job: any,
    baseId: string,
    sourceId: string,
    modelId: string,
    parsedData: any[],
    headers: string[],
    columnMapping: Record<string, string>,
    options: any
  ) {
    await this.jobsLogService.log(job, `Importing to existing table`);

    // Get model
    const model = await Model.get(modelId);

    // Get columns
    const columns = await this.columnsService.columnList({
      baseId,
      sourceId,
      modelId,
    });

    // Map column names to database column names
    const columnMap: Record<string, string> = {};
    columns.forEach(column => {
      columnMap[column.title] = column.column_name;
    });

    if (parsedData.length > 0) {
      await this.jobsLogService.log(job, `Inserting ${parsedData.length} rows`);
      
      // Map data to match column names
      const mappedData = parsedData.map(row => {
        const mappedRow: Record<string, any> = {};
        headers.forEach(header => {
          const mappedColumnTitle = columnMapping[header];
          if (mappedColumnTitle && columnMap[mappedColumnTitle]) {
            mappedRow[columnMap[mappedColumnTitle]] = row[header];
          }
        });
        return mappedRow;
      });

      // Insert data in batches of 100
      const batchSize = 100;
      for (let i = 0; i < mappedData.length; i += batchSize) {
        const batch = mappedData.slice(i, i + batchSize);
        await this.bulkDataService.bulkDataInsert({
          baseId,
          sourceId,
          modelId,
          body: batch,
        }, { user: data.user });
        
        await this.jobsLogService.log(job, `Inserted rows ${i + 1} to ${Math.min(i + batchSize, mappedData.length)}`);
      }
    }

    await this.jobsLogService.log(job, `CSV import completed successfully`);
    return { model };
  }

  private async createDefaultViews(table: any) {
    // Create grid view
    const grid = await this.gridsService.gridViewCreate({
      baseId: table.base_id,
      sourceId: table.source_id,
      modelId: table.id,
      title: 'Grid',
    });

    // Create grid columns
    const columns = await this.columnsService.columnList({
      baseId: table.base_id,
      sourceId: table.source_id,
      modelId: table.id,
    });

    for (const column of columns) {
      await this.gridColumnsService.gridColumnCreate({
        baseId: table.base_id,
        sourceId: table.source_id,
        modelId: table.id,
        gridId: grid.id,
        columnId: column.id,
      });
    }

    // Create form view
    const form = await this.formsService.formViewCreate({
      baseId: table.base_id,
      sourceId: table.source_id,
      modelId: table.id,
      title: 'Form',
    });

    // Create form columns
    for (const column of columns) {
      await this.formColumnsService.formColumnCreate({
        baseId: table.base_id,
        sourceId: table.source_id,
        modelId: table.id,
        formId: form.id,
        columnId: column.id,
      });
    }

    // Create gallery view
    await this.galleriesService.galleryViewCreate({
      baseId: table.base_id,
      sourceId: table.source_id,
      modelId: table.id,
      title: 'Gallery',
    });
  }
}
