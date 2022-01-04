import { NcConfig } from '../../../interface/config';
import Noco from '../Noco';
import { XKnex } from '../../dataMapper';

const META_TABLES = {
  graphql: [
    'nc_models',
    'nc_resolvers',
    'nc_loaders',
    'nc_store',
    'nc_hooks',
    'nc_roles',
    'nc_acl',
    'nc_api_tokens',
    'nc_relations',
    'nc_migrations',
    'nc_disabled_models_for_role',
    'nc_shared_views',
    'nc_shared_bases',
    'nc_cron',
    'nc_audit'
  ],
  grpc: [
    'nc_models',
    'nc_rpc',
    'nc_store',
    'nc_hooks',
    'nc_roles',
    'nc_acl',
    'nc_relations',
    'nc_migrations',
    'nc_api_tokens',
    'nc_disabled_models_for_role',
    'nc_shared_views',
    'nc_cron',
    'nc_shared_bases'
  ],
  rest: [
    'nc_models',
    'nc_routes',
    'nc_store',
    'nc_hooks',
    'nc_roles',
    'nc_acl',
    'nc_relations',
    'nc_migrations',
    'nc_api_tokens',
    'nc_disabled_models_for_role',
    'nc_shared_views',
    'nc_cron',
    'nc_audit',
    'nc_shared_bases'
  ]
};

export default abstract class NcMetaIO {
  protected app: Noco;
  protected config: NcConfig;

  public abstract get knexConnection(): XKnex;

  constructor(app: Noco, config: NcConfig) {
    this.app = app;
    this.config = config;
  }

  public abstract metaInit(): Promise<boolean>;

  public abstract metaInsert(
    project_id: string,
    dbAlias: string,
    target: string,
    data: any
  ): Promise<any>;

  public abstract audit(
    project_id: string,
    dbAlias: string,
    target: string,
    data: any
  ): Promise<any>;

  public abstract metaUpdate(
    project_id: string,
    dbAlias: string,
    target: string,
    data: any,
    idOrCondition: string | { [key: string]: any },
    xcCondition?: XcCondition
  ): Promise<void>;

  public abstract metaDelete(
    project_id: string,
    dbAlias: string,
    target: string,
    idOrCondition?: string | { [key: string]: any },
    xcCondition?: XcCondition
  ): Promise<void>;

  public abstract metaDeleteAll(
    project_id: string,
    dbAlias: string
  ): Promise<void>;

  public abstract metaGet(
    project_id: string,
    dbAlias: string,
    target: string,
    idOrCondition: string | { [key: string]: any },
    fields?: string[],
    xcCondition?: XcCondition
  ): Promise<any>;

  public abstract metaList(
    project_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [key: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?: XcCondition;
      fields?: string[];
      orderBy?: { [key: string]: 'asc' | 'desc' };
    }
  ): Promise<any[]>;

  public abstract metaPaginatedList(
    project_id: string,
    dbAlias: string,
    target: string,
    args?: {
      condition?: { [key: string]: any };
      limit?: number;
      offset?: number;
      xcCondition?: XcCondition;
      fields?: string[];
      sort?: { field: string; desc?: boolean };
    }
  ): Promise<{
    list: any[];
    count: number;
  }>;

  public abstract isMetaDataExists(
    project_id: string,
    dbAlias: string
  ): Promise<boolean>;

  public abstract metaReset(
    project_id: string,
    dbAlias: string,
    apiType?: string
  ): Promise<void>;

  public abstract projectCreate(
    projectName: string,
    config: any,
    description?: string,
    meta?: boolean
  ): Promise<any>;

  public abstract projectUpdate(projectId: string, config: any): Promise<any>;

  public abstract projectAddUser(
    projectId: string,
    userId: any,
    roles: string
  ): Promise<any>;

  public abstract projectRemoveUser(
    projectId: string,
    userId: any
  ): Promise<any>;

  public abstract projectStatusUpdate(
    projectId: string,
    status: string
  ): Promise<any>;

  public abstract projectList(): Promise<any[]>;

  public abstract userProjectList(userId: any): Promise<any[]>;

  public abstract isUserHaveAccessToProject(
    projectId: string,
    userId: any
  ): Promise<boolean>;

  public abstract projectGet(
    projectName: string,
    encrypt?: boolean
  ): Promise<any>;

  public abstract projectGetById(
    projectId: string,
    encrypt?: boolean
  ): Promise<any>;

  public abstract projectDelete(title: string): Promise<any>;
  public abstract projectDeleteById(id: string): Promise<any>;

  public abstract startTransaction();

  public abstract commit();

  public abstract rollback(e?);

  public abstract get knex(): any;

  public setConfig(config: NcConfig) {
    this.config = config;
  }
}

type XcConditionStr = {
  [key in 'lt' | 'gt' | 'le' | 'ge' | 'like' | 'nlike' | 'eq' | 'in' | 'nin']:
    | string
    | number
    | boolean
    | Date;
};

interface XcCondition {
  _and?: XcCondition[];
  _or?: XcCondition[];
  _not?: XcCondition;

  [key: string]: XcConditionStr | any;
}

export { META_TABLES };
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
