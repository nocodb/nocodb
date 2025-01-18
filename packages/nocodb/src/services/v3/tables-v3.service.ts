import { Injectable, Logger } from '@nestjs/common';
import { NcApiVersion, UITypes } from 'nocodb-sdk';
import type {
  TableCreateV3Type,
  TableReqType,
  TableUpdateV3Type,
  TableV3Type,
  UserType,
} from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base } from '~/models';
import { ColumnsService } from '~/services/columns.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  columnBuilder,
  columnV3ToV2Builder,
} from '~/utils/api-v3-data-transformation.builder';
import { TablesService } from '~/services/tables.service';
import { tableReadBuilder, tableViewBuilder } from '~/utils/builders/table';
import { validatePayload } from '~/helpers';

@Injectable()
export class TablesV3Service {
  protected logger = new Logger(TablesV3Service.name);

  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
    protected readonly tablesService: TablesService,
  ) {}

  async tableUpdate(
    context: NcContext,
    param: {
      tableId: any;
      table: TableUpdateV3Type;
      baseId?: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/TableUpdate',
      param.table,
      true,
    );

    const tableUpdateReq: Partial<TableReqType> = { ...param.table };

    // if title includes then add table_name as well
    if (tableUpdateReq.title) {
      tableUpdateReq.table_name = tableUpdateReq.title;
    }

    await this.tablesService.tableUpdate(context, {
      tableId: param.tableId,
      table: tableUpdateReq,
      baseId: param.baseId,
      user: param.user,
      req: param.req,
    });

    return await this.getTableWithAccessibleViews(context, {
      tableId: param.tableId,
      user: param.user,
    });
  }

  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      user: User;
      forceDeleteRelations?: boolean;
      req?: any;
    },
  ) {
    await this.tablesService.tableDelete(context, param);
    return {};
  }

  async getTableWithAccessibleViews(
    context: NcContext,
    param: {
      tableId: string;
      user: User | UserType;
    },
  ) {
    const table = await this.tablesService.getTableWithAccessibleViews(
      context,
      param,
    );
    const result = tableReadBuilder().build(table);

    const viewBuilder = tableViewBuilder();
    result.views = table.views.map((view) => {
      return viewBuilder.build(view);
    });

    result.display_field_id = table.columns.find((column) => column.pv)?.id;

    result.fields = table.columns
      .filter((c) => !c.system || c.uidt === UITypes.ID)
      .map((column) => {
        return columnBuilder().build(column);
      });

    return result;
  }

  async getAccessibleTables(
    context: NcContext,
    param: {
      baseId: string;
      sourceId: string;
      includeM2M?: boolean;
      roles: Record<string, boolean>;
    },
  ) {
    const tables = await this.tablesService.getAccessibleTables(context, param);

    const metaSourceId = (
      await Base.get(context, param.baseId).then((base) => base?.getSources())
    )?.find((source) => source.isMeta)?.id;

    return tableReadBuilder().build(
      tables.map((table) => {
        // exclude source_id for tables from meta source
        if (metaSourceId && table.source_id === metaSourceId) {
          table.source_id = undefined;
        }
        return table;
      }),
    ) as unknown as TableV3Type[];
  }

  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      table: TableCreateV3Type;
      user: User | UserType;
      req?: any;
      sourceId?: string;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/TableCreate',
      param.table,
      true,
    );

    const tableCreateReq: any = param.table;

    // remap the columns if provided
    if (tableCreateReq.fields) {
      tableCreateReq.columns = columnV3ToV2Builder().build(
        tableCreateReq.fields,
      );
    } else {
      tableCreateReq.columns = [];
    }

    const tableCreateOutput = await this.tablesService.tableCreate(context, {
      baseId: param.baseId,
      table: tableCreateReq,
      user: param.user,
      req: param.req,
      apiVersion: NcApiVersion.V3,
      sourceId: param.sourceId,
    });

    const result = tableReadBuilder().build(tableCreateOutput);

    result.display_field_id = tableCreateOutput.columns.find(
      (column) => column.pv,
    )?.id;

    result.fields = tableCreateOutput.columns
      .filter((c) => !c.system || c.uidt === UITypes.ID)
      .map((column) => {
        return columnBuilder().build(column);
      });

    return result;
  }
}
