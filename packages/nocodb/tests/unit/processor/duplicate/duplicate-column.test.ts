import type { INestApplication } from '@nestjs/common';
import 'mocha';
import type { DuplicateColumnJobData } from '../../../../src/interface/Jobs';
import type { ITestContext } from './init-duplicate';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { listRow } from '../../factory/row';
import { initDuplicate } from './init-duplicate';
import { getTable } from '../../factory/table';
import { expect } from 'chai';

function duplicateColumnTests() {
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

  it('will duplicate Title column successfully', async () => {
    const user = context.context.user;
    const table1 = await getTable({
      base: context.base,
      name: tables.table1.table_name,
    });
    await duplicateProcessor.duplicateColumn({
      data: {
        id: 'acuhqjqiq7',
        jobName: 'DuplicateColumn',
        context: context.ctx,
        baseId: context.base.id,
        user: user as any,
        modelId: table1.id,
        sourceId: table1.source_id,
        columnId: (
          await table1.getColumns(context.ctx)
        ).find((col) => col.title === 'Title').id,
        extra: {}, // extra data
        req: {
          user,
        },
        options: {
          excludeData: false,
        },
      } as DuplicateColumnJobData,
    } as any);

    const row = await listRow({
      base: context.base,
      table: tables.table1,
    });
    expect(row[0]).to.have.property('Title copy');
    expect(row[0].Title).to.eq(row[0]['Title copy']);
  });
}

export default function () {
  describe('DuplicateColumnTest', duplicateColumnTests);
}
