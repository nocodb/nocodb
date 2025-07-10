import type { INestApplication } from '@nestjs/common';
import 'mocha';
import type { DuplicateModelJobData } from '../../../../src/interface/Jobs';
import type { ITestContext } from './init-duplicate';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { listRow } from '../../factory/row';
import { initDuplicate } from './init-duplicate';
import { getAllTables, getTable } from '../../factory/table';
import { expect } from 'chai';

function duplicateModelTests() {
  let context: ITestContext;
  let nestApp: INestApplication<any>;
  let duplicateProcessor: DuplicateProcessor;
  let tables: {
    table1;
    table2;
    table3;
    table4;
  };

  beforeEach(async function () {
    console.time('#### duplicateColumnTests');
    const initDuplicateResult = await initDuplicate();
    context = initDuplicateResult;
    nestApp = initDuplicateResult.context.nestApp;
    duplicateProcessor = nestApp.get(DuplicateProcessor);
    tables = initDuplicateResult.tables;
    console.timeEnd('#### duplicateColumnTests');
  });

  it('will duplicate model successfully', async () => {
    const user = context.context.user;
    const table1 = await getTable({
      base: context.base,
      name: tables.table1.table_name,
    });
    await duplicateProcessor.duplicateModel({
      data: {
        id: 'acuhqjqiq7',
        jobName: 'DuplicateModel',
        context: context.ctx,
        baseId: context.base.id,
        user: user as any,
        modelId: table1.id,
        sourceId: table1.source_id,
        title: 'Table1 copy',
        extra: {}, // extra data
        req: {
          user,
        },
        options: {},
      } as DuplicateModelJobData,
    } as any);

    const newTables = await getAllTables({ base: context.base });
    const table1Copy = newTables.find(
      (table) => table.title === 'Table1 copy',
    )!;
    const row = await listRow({
      base: context.base,
      table: table1Copy,
    });
    expect(row.length).to.gte(40);
  });
}

export default function () {
  describe('DuplicateModelTest', duplicateModelTests);
}
