import { Injectable } from '@nestjs/common';
import { ViewTypes } from 'nocodb-sdk';

import { PublicDatasService as PublicDatasServiceCE } from 'src/services/public-datas.service';
import type { NcContext } from '~/interface/config';
import { Model, Source, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';
import { DataOptService } from '~/services/data-opt/data-opt.service';
import { DatasService } from '~/services/datas.service';

@Injectable()
export class PublicDatasService extends PublicDatasServiceCE {
  constructor(
    protected dataService: DatasService,
    private dataOptService: DataOptService,
  ) {
    super(dataService);
  }

  async bulkAggregate(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
      body: any;
    },
  ) {
    const view = await View.getByUUID(context, param.sharedViewUuid);

    if (!view) NcError.viewNotFound(param.sharedViewUuid);

    if (view.type !== ViewTypes.GRID) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== param.password) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    let bulkFilterList = param.body;

    const listArgs: any = { ...param.query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const data = await baseModel.bulkAggregate(listArgs, bulkFilterList, view);

    return data;
  }

  async dataList(
    context: NcContext,
    param: {
      sharedViewUuid: string;
      password?: string;
      query: any;
    },
  ) {
    const { sharedViewUuid, password } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.viewNotFound(sharedViewUuid);
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.MAP &&
      view.type !== ViewTypes.CALENDAR
    ) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== password) {
      return NcError.invalidSharedViewPassword();
    }

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id,
    });

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    if (
      (['mysql', 'mysql2'].includes(source.type) &&
        (await isMysqlVersionSupported(context, source))) ||
      ['pg'].includes(source.type)
    ) {
      return await this.dataOptService.list(context, {
        model,
        view,
        params: param.query,
        source,
        throwErrorIfInvalidParams: true,
        baseModel,
      });
    }
    return await super.dataList(context, param);
  }
}
