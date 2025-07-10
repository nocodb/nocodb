import type { INestApplication } from '@nestjs/common';
import 'mocha';
import type { DuplicateBaseJobData } from '../../../../src/interface/Jobs';
import type { ITestContext } from './init-duplicate';
import type { BaseReqType } from 'nocodb-sdk';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { BasesService } from '~/services/bases.service';
import { listRow } from '../../factory/row';
import { initDuplicate } from './init-duplicate';
import { getAllTables, getTable } from '../../factory/table';
import { expect } from 'chai';
import { listBase } from '../../factory/base';
import { ProjectStatus } from 'nocodb-sdk';

function duplicateBaseTests() {
  let context: ITestContext;
  let nestApp: INestApplication<any>;
  let duplicateProcessor: DuplicateProcessor;
  let basesService: BasesService;
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
    basesService = nestApp.get(BasesService);
    tables = initDuplicateResult.tables;
    console.timeEnd('#### duplicateColumnTests');
  });

  it('will duplicate base successfully', async () => {
    const user = context.context.user;

    const sources = await context.base.getSources();
    const dupProject = await basesService.baseCreate({
      base: {
        title: 'Dup base',
        status: ProjectStatus.JOB,
        sources: [
          {
            inflection_column: sources[0].inflection_column,
            inflection_table: sources[0].inflection_table,
            is_meta: sources[0].is_meta,
            is_local: sources[0].is_local,
            is_schema_readonly: sources[0].is_schema_readonly,
            is_data_readonly: sources[0].is_data_readonly,
            type: sources[0].type,
          },
        ] as BaseReqType[],
        type: 'database',
        ...(context.ctx.workspace_id
          ? { fk_workspace_id: context.ctx.workspace_id }
          : {}),
      },
      user,
      req: { user: user } as any,
    });

    await duplicateProcessor.duplicateBase({
      data: {
        id: 'acuhqjqiq7',
        jobName: 'DuplicateBase',
        baseId: context.base.id,
        context: context.ctx,
        dupProjectId: dupProject.id,
        user: user as any,
        sourceId: (await context.base.getSources())[0].id,
        title: 'Base copy',
        extra: {}, // extra data
        req: {
          user,
        },
        options: {},
      } as DuplicateBaseJobData,
    } as any);

    const bases = await listBase(context.ctx.workspace_id);
    const newDupBase = bases.find((b) => b.id === dupProject.id)!;
    const dupBaseTables = await getAllTables({ base: newDupBase });
    expect(dupBaseTables.length).to.gt(0);
    const dupTable1 = dupBaseTables.find(
      (t) => t.title === tables.table1.title,
    );
    const columns = await dupTable1?.getColumns({
      workspace_id: context.ctx.workspace_id,
      base_id: newDupBase.id,
    });
    expect(columns?.length).to.gt(0);
    expect(columns?.some((col) => col.title === 'Title')).to.eq(true);

    const row = await listRow({
      base: newDupBase,
      table: dupTable1!,
    });
    expect(row.length).to.gt(0);
    expect(row[0]).to.have.property('Title');
  });
}

export default function () {
  describe('DuplicateBaseTests', duplicateBaseTests);
}
