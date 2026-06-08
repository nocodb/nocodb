import 'mocha';
import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { UITypes } from 'nocodb-sdk';
import type { INestApplication } from '@nestjs/common';
import type Base from '~/models/Base';
import { DataImportProcessor } from '~/modules/jobs/jobs/data-import/data-import.processor';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { getToolDir } from '~/utils/nc-config';
import init from '../../init';
import { createProject } from '../../factory/base';
import { createTable } from '../../factory/table';
import { createBulkRows } from '../../factory/row';
import { createLtarColumn, customColumns } from '../../factory/column';

// Integration tests for LTAR/link import (PR #9130). Drives the real
// DataImportProcessor against a CSV fixture and asserts the link phase's
// reported stats (linksCreated / valuesUnmatched), which is the same surface
// the UI/job log consumes.
function linksImportTests() {
  let context: Awaited<ReturnType<typeof init>>;
  let nestApp: INestApplication<any>;
  let processor: DataImportProcessor;
  let base: Base;
  let ctx: { workspace_id: any; base_id: any };

  const uploadsDir = () => path.join(getToolDir(), 'nc', 'uploads');

  // Write a CSV fixture into the local-storage uploads dir and return the
  // attachment `path` the processor resolves against. The processor deletes the
  // file in its `finally`, so each run consumes its own fixture.
  const writeCsv = (fileName: string, rows: string[][]): string => {
    fs.mkdirSync(uploadsDir(), { recursive: true });
    const csv = rows.map((r) => r.join(',')).join('\n');
    fs.writeFileSync(path.join(uploadsDir(), fileName), csv, 'utf-8');
    return fileName;
  };

  const runImport = async (args: {
    table: { id: string; title: string; source_id: string };
    fileName: string;
    columns: Array<{ title: string; uidt: any; key: number }>;
    mapping: Array<{
      sourceCn: string;
      destCn: string;
      linkConfig?: { delimiter?: string };
    }>;
  }) => {
    const jobData = {
      jobName: 'DataImport',
      context: ctx,
      baseId: base.id,
      sourceId: args.table.source_id,
      user: context.user,
      importType: 'csv',
      attachment: {
        path: args.fileName,
        title: args.fileName,
        mimetype: 'text/csv',
      },
      parserConfig: { firstRowAsHeaders: true },
      options: { shouldImportData: true, importDataOnly: true },
      req: { user: context.user },
      sheets: [
        {
          tableId: args.table.id,
          tableName: args.table.title,
          columns: args.columns.map((c) => ({
            title: c.title,
            column_name: c.title,
            uidt: c.uidt,
            key: c.key,
          })),
          columnMapping: args.mapping.map((m) => ({
            sourceCn: m.sourceCn,
            destCn: m.destCn,
            enabled: true,
            ...(m.linkConfig ? { linkConfig: m.linkConfig } : {}),
          })),
        },
      ],
    };

    return processor.job({ data: jobData, id: 'links-import-test' } as any);
  };

  beforeEach(async function () {
    context = await init();
    nestApp = context.nestApp;
    processor = nestApp.get(DataImportProcessor);
    base = await createProject(context);
    ctx = { workspace_id: base.fk_workspace_id, base_id: base.id };
  });

  afterEach(function () {
    delete process.env.NC_DATA_IMPORT_LINK_FLUSH_THRESHOLD;
  });

  it('creates links for matched display values and counts unmatched (cross-table)', async () => {
    // Target table holds the records to link to (display value = Title).
    const target = await createTable(context, base, {
      title: 'LinkTarget',
      table_name: 'link_target',
      columns: customColumns('custom', [
        { title: 'Title', column_name: 'Title', uidt: UITypes.SingleLineText, pv: true },
      ]),
    });
    await createBulkRows(context, {
      base,
      table: target,
      values: [{ Title: 'Alice' }, { Title: 'Bob' }],
    });

    // Source table with a text col + a m2m link to the target.
    const source = await createTable(context, base, {
      title: 'LinkSource',
      table_name: 'link_source',
      columns: customColumns('custom', [
        { title: 'Name', column_name: 'Name', uidt: UITypes.SingleLineText, pv: true },
      ]),
    });
    await createLtarColumn(context, {
      title: 'Friends',
      parentTable: source,
      childTable: target,
      type: 'mm',
    });

    // One row links a real record ("Alice"), one links a value that matches
    // nothing ("Zzz") → 1 created, 1 unmatched.
    const fileName = writeCsv('cross-table-links.csv', [
      ['Name', 'Friends'],
      ['Row1', 'Alice'],
      ['Row2', 'Zzz'],
    ]);

    const result = await runImport({
      table: source,
      fileName,
      columns: [
        { title: 'Name', uidt: UITypes.SingleLineText, key: 0 },
        { title: 'Friends', uidt: UITypes.Links, key: 1 },
      ],
      mapping: [
        { sourceCn: 'Name', destCn: 'Name' },
        { sourceCn: 'Friends', destCn: 'Friends', linkConfig: { delimiter: ',' } },
      ],
    });

    expect(result.rowsInserted).to.eq(2);
    expect(result.linksCreated).to.eq(1);
    expect(result.valuesUnmatched).to.eq(1);
  });

  it('resolves a forward self-reference even when a mid-stream flush fires', async () => {
    // Force the multi-flush path (default threshold is 50k): with this set to 1,
    // links would flush right after the first 1000-row batch — BEFORE later rows
    // exist. The self-ref guard must defer resolution to the end so a forward
    // reference (row 5 → "r1001", inserted in the 2nd batch) still resolves.
    process.env.NC_DATA_IMPORT_LINK_FLUSH_THRESHOLD = '1';

    const table = await createTable(context, base, {
      title: 'SelfRef',
      table_name: 'self_ref',
      columns: customColumns('custom', [
        { title: 'Title', column_name: 'Title', uidt: UITypes.SingleLineText, pv: true },
      ]),
    });
    // Self-referential m2m: related table == this table.
    await createLtarColumn(context, {
      title: 'Related',
      parentTable: table,
      childTable: table,
      type: 'mm',
    });

    // 1001 rows so the importer flushes after the first 1000-row batch. Only
    // row 5 carries a link, pointing forward to "r1001" (inserted in batch 2).
    const TOTAL = 1001;
    const rows: string[][] = [['Title', 'Related']];
    for (let i = 1; i <= TOTAL; i++) {
      rows.push([`r${i}`, i === 5 ? 'r1001' : '']);
    }
    const fileName = writeCsv('self-ref-links.csv', rows);

    const result = await runImport({
      table,
      fileName,
      columns: [
        { title: 'Title', uidt: UITypes.SingleLineText, key: 0 },
        { title: 'Related', uidt: UITypes.Links, key: 1 },
      ],
      mapping: [
        { sourceCn: 'Title', destCn: 'Title' },
        { sourceCn: 'Related', destCn: 'Related', linkConfig: { delimiter: ',' } },
      ],
    });

    expect(result.rowsInserted).to.eq(TOTAL);
    // Without the self-ref guard this would be 0 (resolved against a partial
    // table at the mid-stream flush, then cached as unmatched).
    expect(result.linksCreated).to.eq(1);
    expect(result.valuesUnmatched).to.eq(0);
  });

  it('actually flushes mid-stream (cross-table) and links correctly across batches', async () => {
    // threshold=1 + >1000 rows forces a real mid-stream flush after the first
    // 1000-row batch (cross-table → not deferred). We assert the link phase ran
    // TWICE (mid-stream + final) AND that links from both batches were created.
    process.env.NC_DATA_IMPORT_LINK_FLUSH_THRESHOLD = '1';

    const target = await createTable(context, base, {
      title: 'FlushTarget',
      table_name: 'flush_target',
      columns: customColumns('custom', [
        { title: 'Title', column_name: 'Title', uidt: UITypes.SingleLineText, pv: true },
      ]),
    });
    await createBulkRows(context, {
      base,
      table: target,
      values: [{ Title: 'Alice' }, { Title: 'Bob' }],
    });

    const source = await createTable(context, base, {
      title: 'FlushSource',
      table_name: 'flush_source',
      columns: customColumns('custom', [
        { title: 'Name', column_name: 'Name', uidt: UITypes.SingleLineText, pv: true },
      ]),
    });
    await createLtarColumn(context, {
      title: 'Friends',
      parentTable: source,
      childTable: target,
      type: 'mm',
    });

    // Row 5 (batch 1) links "Alice"; row 1001 (batch 2) links "Bob". The batch-1
    // link forces the mid-stream flush; the batch-2 link forces the final flush.
    const TOTAL = 1001;
    const rows: string[][] = [['Name', 'Friends']];
    for (let i = 1; i <= TOTAL; i++) {
      rows.push([`n${i}`, i === 5 ? 'Alice' : i === TOTAL ? 'Bob' : '']);
    }
    const fileName = writeCsv('flush-links.csv', rows);

    // Count how many times the link phase ran by spying on the singleton
    // JobsLogService the processor logs through. 1 = single end-pass (no flush);
    // 2 = a real mid-stream flush happened.
    const jobsLogService = nestApp.get(JobsLogService);
    const originalSendLog = jobsLogService.sendLog.bind(jobsLogService);
    let linkPhaseRuns = 0;
    (jobsLogService as any).sendLog = (job: any, payload: { message: string }) => {
      if (payload?.message?.includes('Creating record links')) linkPhaseRuns++;
      return originalSendLog(job, payload);
    };

    let result;
    try {
      result = await runImport({
        table: source,
        fileName,
        columns: [
          { title: 'Name', uidt: UITypes.SingleLineText, key: 0 },
          { title: 'Friends', uidt: UITypes.Links, key: 1 },
        ],
        mapping: [
          { sourceCn: 'Name', destCn: 'Name' },
          { sourceCn: 'Friends', destCn: 'Friends', linkConfig: { delimiter: ',' } },
        ],
      });
    } finally {
      (jobsLogService as any).sendLog = originalSendLog;
    }

    expect(result.rowsInserted).to.eq(TOTAL);
    expect(linkPhaseRuns).to.eq(2); // mid-stream flush + final flush
    expect(result.linksCreated).to.eq(2); // Alice (batch 1) + Bob (batch 2)
    expect(result.valuesUnmatched).to.eq(0);
  });
}

export default function () {
  describe('LinksImportTest', linksImportTests);
}
