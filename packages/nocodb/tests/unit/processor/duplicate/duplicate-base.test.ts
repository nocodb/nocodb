import type { INestApplication } from '@nestjs/common';
import 'mocha';
import type { DuplicateBaseJobData } from '../../../../src/interface/Jobs';
import type { ITestContext } from './init-duplicate';
import type { BaseReqType } from 'nocodb-sdk';
import { UITypes } from 'nocodb-sdk';
import { DuplicateProcessor } from '../../../../src/modules/jobs/jobs/export-import/duplicate.processor';
import { BasesService } from '../../../../src/services/bases.service';
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

    const dupProject = await basesService.baseCreate({
      base: {
        title: 'Dup base',
        status: ProjectStatus.JOB,
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
    const dupTable2 = dupBaseTables.find(
      (t) => t.title === tables.table2.title,
    );
    const columns = await dupTable2?.getColumns({
      workspace_id: context.ctx.workspace_id,
      base_id: newDupBase.id,
    });
    
    expect(columns?.length).to.gt(0);
    
    const expectedColumns = ['Title', 'Number', 'Date', 'DateTime', 'SingleSelect', 'MultiSelect', 'Checkbox', 'Email', 'Currency', 'Percent', 'Rating'];
    expectedColumns.forEach(colTitle => {
      expect(columns?.some((col) => col.title === colTitle)).to.eq(true, `Column ${colTitle} should exist`);
    });
    
    const titleCol = columns?.find(col => col.title === 'Title');
    expect(titleCol?.uidt).to.eq(UITypes.SingleLineText);
    
    const numberCol = columns?.find(col => col.title === 'Number');
    expect(numberCol?.uidt).to.eq(UITypes.Number);
    
    const dateCol = columns?.find(col => col.title === 'Date');
    expect(dateCol?.uidt).to.eq(UITypes.Date);
    
    const dateTimeCol = columns?.find(col => col.title === 'DateTime');
    expect(dateTimeCol?.uidt).to.eq(UITypes.DateTime);
    
    const singleSelectCol = columns?.find(col => col.title === 'SingleSelect');
    expect(singleSelectCol?.uidt).to.eq(UITypes.SingleSelect);
    expect(singleSelectCol?.dtxp).to.include('option1');
    
    const multiSelectCol = columns?.find(col => col.title === 'MultiSelect');
    expect(multiSelectCol?.uidt).to.eq(UITypes.MultiSelect);
    expect(multiSelectCol?.dtxp).to.include('tag1');
    
    const checkboxCol = columns?.find(col => col.title === 'Checkbox');
    expect(checkboxCol?.uidt).to.eq(UITypes.Checkbox);
    
    const emailCol = columns?.find(col => col.title === 'Email');
    expect(emailCol?.uidt).to.eq(UITypes.Email);
    
    const currencyCol = columns?.find(col => col.title === 'Currency');
    expect(currencyCol?.uidt).to.eq(UITypes.Currency);
    
    const percentCol = columns?.find(col => col.title === 'Percent');
    expect(percentCol?.uidt).to.eq(UITypes.Percent);
    
    const ratingCol = columns?.find(col => col.title === 'Rating');
    expect(ratingCol?.uidt).to.eq(UITypes.Rating);

    const row = await listRow({
      base: newDupBase,
      table: dupTable2!,
    });
    expect(row.length).to.gt(0);
    
    expect(row[0]).to.have.property('Title');
    expect(row[0].Title).to.eq('T2_001');
    
    expect(row[0]).to.have.property('Number');
    expect(typeof row[0].Number).to.eq('number');
    
    expect(row[0]).to.have.property('Date');
    expect(row[0].Date).to.match(/^\d{4}-\d{2}-\d{2}$/);
    
    expect(row[0]).to.have.property('DateTime');
    expect(row[0].DateTime).to.match(/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/);
    
    expect(row[0]).to.have.property('SingleSelect');
    expect(['option1', 'option2', 'option3']).to.include(row[0].SingleSelect);
    
    expect(row[0]).to.have.property('MultiSelect');
    expect(row[0].MultiSelect).to.be.a('string');
    
    expect(row[0]).to.have.property('Checkbox');
    expect([true, false, 0, 1]).to.include(row[0].Checkbox);
    
    expect(row[0]).to.have.property('Email');
    expect(row[0].Email).to.match(/^test\d+@example\.com$/);
    
    expect(row[0]).to.have.property('Currency');
    expect(typeof row[0].Currency).to.eq('number');
    
    expect(row[0]).to.have.property('Percent');
    expect(typeof row[0].Percent).to.eq('number');
    
    expect(row[0]).to.have.property('Rating');
    expect(typeof row[0].Rating).to.eq('number');
    expect(row[0].Rating).to.be.within(1, 5);
  });
}

export default function () {
  describe('DuplicateBaseTests', duplicateBaseTests);
}
