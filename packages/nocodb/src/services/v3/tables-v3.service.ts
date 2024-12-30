import { Injectable, Logger } from '@nestjs/common';
import { NcApiVersion, UITypes, viewTypeAlias } from 'nocodb-sdk';
import type { TableReqType, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base, Model } from '~/models';
import { ColumnsService } from '~/services/columns.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  builderGenerator,
  columnBuilder,
  columnV3ToV2Builder,
} from '~/utils/api-v3-data-transformation.builder';
import { TablesService } from '~/services/tables.service';

@Injectable()
export class TablesV3Service {
  protected logger = new Logger(TablesV3Service.name);
  protected tableReadBuilder;
  protected viewBuilder;

  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
    protected readonly tablesService: TablesService,
  ) {
    this.tableReadBuilder = builderGenerator({
      allowed: [
        'id',
        'source_id',
        'base_id',
        'title',
        'description',
        'fk_workspace_id',
        'source_id',
        'meta',
      ],
      mappings: {
        fk_workspace_id: 'workspace_id',
      },
      transformFn: (table) => {
        // if description is empty, set it to undefined
        if (table.description === '') {
          table.description = undefined;
        }
        return table;
      },
      meta: {
        snakeCase: true,
        metaProps: ['meta'],
        allowed: ['icon_color'],
      },
    });

    this.viewBuilder = builderGenerator({
      allowed: ['id', 'title', 'type'],
      transformFn: (view) => {
        return {
          ...view,
          view_type: viewTypeAlias[view.type],
          type: undefined,
        };
      },
    });
  }

  async tableUpdate(
    context: NcContext,
    param: {
      tableId: any;
      table: TableReqType & { base_id?: string };
      baseId?: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    await this.tablesService.tableUpdate(context, {
      tableId: param.tableId,
      table: param.table,
      baseId: param.baseId,
      user: param.user,
      req: param.req,
    });

    const table = await Model.get(context, param.tableId);

    return this.tableReadBuilder().build(table);
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
    const result = this.tableReadBuilder().build(table);

    const viewBuilder = this.viewBuilder();
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

    return this.tableReadBuilder().build(
      tables.map((table) => {
        // exclude source_id for tables from meta source
        if (metaSourceId && table.source_id === metaSourceId) {
          table.source_id = undefined;
        }
        return table;
      }),
    );
  }

  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      table: TableReqType;
      user: User | UserType;
      req?: any;
      sourceId?: string;
    },
  ) {
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

    const result = this.tableReadBuilder().build(tableCreateOutput);

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
