import { Injectable, Logger } from '@nestjs/common';
import { TablesV3Service as TablesV3ServiceCE } from 'src/services/v3/tables-v3.service';
import type { UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcContext } from '~/interface/config';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';
import { TablesService } from '~/services/tables.service';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';

@Injectable()
export class TablesV3Service extends TablesV3ServiceCE {
  protected logger = new Logger(TablesV3Service.name);

  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly columnsService: ColumnsService,
    protected readonly tablesService: TablesService,
    protected readonly columnsV3Service: ColumnsV3Service,
    protected readonly baseTrashService: BaseTrashService,
  ) {
    super(
      metaDiffService,
      appHooksService,
      columnsService,
      tablesService,
      columnsV3Service,
    );
  }

  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      user: User | UserType;
      forceDeleteRelations?: boolean;
      req?: any;
    },
  ) {
    await this.baseTrashService.trashTable(context, {
      tableId: param.tableId,
      user: param.user,
      req: param.req,
    });
    return {};
  }
}
