import { Injectable } from '@nestjs/common';
import { Connection } from '../connection/connection';

@Injectable()
export class MetaService {

  constructor(private connection: Connection) {
  }

  public async metaGet(
    project_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [p: string]: any },
    fields?: string[],
    // xcCondition?
  ): Promise<any> {
    const query = this.connection.knexInstance(target);

    // if (xcCondition) {
    //   query.condition(xcCondition);
    // }

    if (fields?.length) {
      query.select(...fields);
    }

    if (project_id !== null && project_id !== undefined) {
      query.where('project_id', project_id);
    }
    if (dbAlias !== null && dbAlias !== undefined) {
      query.where('db_alias', dbAlias);
    }

    if (!idOrCondition) {
      return query.first();
    }

    if (typeof idOrCondition !== 'object') {
      query.where('id', idOrCondition);
    } else {
      query.where(idOrCondition);
    }

    // console.log(query.toQuery())

    return query.first();
  }

  public async metaInsert2(
    project_id: string,
    base_id: string,
    target: string,
    data: any,
    ignoreIdGeneration?: boolean
  ): Promise<any> {
    const id = data?.id || this.genNanoid(target);
    const insertObj = {
      ...data,
      ...(ignoreIdGeneration ? {} : { id }),
      created_at: data?.created_at || this.knexConnection?.fn?.now(),
      updated_at: data?.updated_at || this.knexConnection?.fn?.now(),
    };
    if (base_id !== null) insertObj.base_id = base_id;
    if (project_id !== null) insertObj.project_id = project_id;

    // validate insert object before insert
    await this.validateObject(target, insertObj);

    await this.knexConnection(target).insert(insertObj);
    return insertObj;
  }

}
