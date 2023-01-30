import { v4 as uuidv4 } from 'uuid';
import { Tele } from 'nc-help';

import NcMetaMgr from './NcMetaMgr';

export default class NcMetaMgrEE extends NcMetaMgr {
  /*  protected async handlePublicRequest(req, res, next) {
      const args = req.body;
      // let result;
      try {
        switch (args.api) {

          default:
            return super.handlePublicRequest(req, res, next)

        }
      } catch (e) {
        return next(e);
      }
    }

    protected async handleRequest(req, res, next) {
      try {
        const args = req.body;
        let result;

        switch (args.api) {


          default:
            return this.handleRequest(req, res, next);
        }
        if (this.listener) {
          await this.listener({
            user: req.user,
            req: req.body,
            res: result,
            ctx: {
              req, res
            }
          });
        }

        if (result && typeof result === 'object' && 'download' in result && 'filePath' in result && result.download === true) {
          return res.download(result.filePath);
        }


        res.json(result);

      } catch (e) {
        console.log(e);
        if (e instanceof XCEeError) {
          res.status(402).json({
            msg: e.message
          })
        } else {
          res.status(400).json({
            msg: e.message
          })
        }
      }
    }*/

  protected async xcTableList(req, args): Promise<any> {
    const roles = req.session?.passport?.user?.roles;

    let tables = await this.xcVisibilityMetaGet({
      ...args,
      args: { type: 'table', ...args.args },
    });

    tables = tables.filter((table: any) => {
      return Object.keys(roles).some(
        (role) => roles[role] && !table.disabled[role]
      );
    });

    return { data: { list: tables } };
  }

  // NOTE: updated
  protected async xcAclSave(args, req): Promise<any> {
    try {
      const dbAlias = await this.getDbAlias(args);
      const projectId = await this.getProjectId(args);
      const res = await this.xcMeta.metaUpdate(
        projectId,
        dbAlias,
        'nc_acl',
        {
          acl: JSON.stringify(args.args.acl),
        },
        {
          tn: args.args.tn || args.args.name,
        }
      );

      this.app.ncMeta.audit(projectId, dbAlias, 'nc_audit', {
        op_type: 'TABLE_ACL',
        op_sub_type: 'UPDATED',
        user: req.user.email,
        description: `updated table ${args.args.tn || args.args.name} acl `,
        ip: req.clientIp,
      });

      Tele.emit('evt', { evt_type: 'acl:updated' });

      return res;
    } catch (e) {
      throw e;
    }
  }

  protected async getSharedViewData(req, args: any): Promise<any> {
    try {
      const sharedViewMeta = await this.xcMeta
        .knex('nc_shared_views')
        .where({
          view_id: args.args.view_id,
        })
        .first();

      if (!sharedViewMeta) {
        throw new Error('Meta not found');
      }

      const viewMeta = await this.xcMeta.metaGet(
        sharedViewMeta.project_id,
        sharedViewMeta.base_id,
        'nc_models',
        {
          title: sharedViewMeta.view_name,
        }
      );

      if (
        viewMeta &&
        viewMeta.password &&
        viewMeta.password !== args.args.password
      ) {
        throw new Error(this.INVALID_PASSWORD_ERROR);
      }

      const apiBuilder = this.app?.projectBuilders
        ?.find((pb) => pb.id === sharedViewMeta.project_id)
        ?.apiBuilders?.find((ab) => ab.dbAlias === sharedViewMeta.base_id);
      const model = apiBuilder?.xcModels?.[sharedViewMeta.model_name];

      let meta = apiBuilder?.getMeta(sharedViewMeta.model_name);

      if (!model) {
        throw new Error('Meta not found');
      }
      const queryParams = JSON.parse(viewMeta.query_params) || {};

      if (!meta) {
        throw new Error('Meta not found');
      }

      meta = {
        ...meta,
        columns: meta.columns.filter((c) => queryParams?.showFields?.[c._cn]),
      };

      let where = '';
      const sort = [];

      if (req.query.where) {
        where += req.query.where;
      }
      const privateViewWhere = this.serializeToXwhere(queryParams?.filters);

      if (privateViewWhere) {
        where += where ? `~and(${privateViewWhere})` : privateViewWhere;
      }
      // if (queryParams.sortList) {
      //   sort.push(
      //     ...(queryParams?.sortList
      //       ?.map(sort => {
      //         return sort.field ? `${sort.order}${sort.field}` : '';
      //       })
      //       .filter(Boolean) || [])
      //   );
      // }

      if (req.query.sort) {
        sort.push(...req.query.sort.split(','));
      }

      const fields = meta.columns.map((c) => c._cn).join(',');
      const nestedParams = this.serializeNestedParams(meta, queryParams);

      return {
        model_name: sharedViewMeta.model_name,
        // meta,
        // queryParams,
        data: await model.nestedList({
          ...req.query,
          where,
          fields,
          sort: sort.join(','),
          ...nestedParams,
        }),
        ...(await model.countByPk({
          ...req.query,
          where,
          fields,
        })),
        client: apiBuilder?.client,
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  protected async createSharedViewLink(req, args: any): Promise<any> {
    try {
      // todo: keep belongs to column if belongs to virtual column present
      // if (args.args.query_params?.fields && args.args.show_as !== 'form') {
      //   const fields = args.args.query_params?.fields.split(',');
      //   args.args.meta.columns = args.args.meta.columns.filter(c =>
      //     fields.includes(c._cn)
      //   );
      // }

      // get existing shared view data if exist

      let sharedView = await this.xcMeta.metaGet(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_views',
        {
          model_name: args.args.model_name,
          view_name: args.args.view_name,
          view_type: args.args.show_as,
        },
        ['id', 'view_id', 'view_type']
      );

      if (!sharedView) {
        const insertData = {
          project_id: args.project_id,
          db_alias: this.getDbAlias(args),
          model_name: args.args.model_name,
          view_name: args.args.view_name,
          // meta: JSON.stringify(args.args.meta),
          // query_params: JSON.stringify(args.args.query_params),
          view_id: uuidv4(),
          password: args.args.password,
          view_type: args.args.show_as,
        };

        await this.xcMeta.metaInsert(
          args.project_id,
          this.getDbAlias(args),
          'nc_shared_views',
          insertData
        );
        sharedView = await this.xcMeta.metaGet(
          this.getProjectId(args),
          this.getDbAlias(args),
          'nc_shared_views',
          insertData,
          ['id', 'view_id', 'view_type']
        );
      }

      if (args.args.show_as === 'form') {
        sharedView.url = `${req.ncSiteUrl}${this.config.dashboardPath}#/nc/form/${sharedView.view_id}`;
      } else if (args.args.show_as === 'gallery') {
        sharedView.url = `${req.ncSiteUrl}${this.config.dashboardPath}#/nc/gallery/${sharedView.view_id}`;
      } else if (args.args.show_as === 'kanban') {
        sharedView.url = `${req.ncSiteUrl}${this.config.dashboardPath}#/nc/kanban/${sharedView.view_id}`;
      } else {
        sharedView.url = `${req.ncSiteUrl}${this.config.dashboardPath}#/nc/view/${sharedView.view_id}`;
      }

      Tele.emit('evt', { evt_type: 'sharedView:generated-link' });
      return sharedView;
    } catch (e) {
      console.log(e);
    }
  }

  protected async updateSharedViewLinkPassword(args: any): Promise<any> {
    try {
      await this.xcMeta.metaUpdate(
        this.getProjectId(args),
        this.getDbAlias(args),
        'nc_shared_views',
        {
          password: args.args?.password,
        },
        args.args.id
      );
      Tele.emit('evt', { evt_type: 'sharedView:password-updated' });
      return { msg: 'Success' };
    } catch (e) {
      console.log(e);
    }
  }

  protected async xcVisibilityMetaSet(args) {
    try {
      let field = '';
      switch (args.args.type) {
        case 'table':
          field = 'tn';
          break;
        case 'function':
          field = 'function_name';
          break;
        case 'procedure':
          field = 'procedure_name';
          break;
        case 'view':
          field = 'view_name';
          break;
        case 'relation':
          field = 'relationType';
          break;
      }

      for (const d of args.args.disableList) {
        const props = {};
        if (field === 'relationType') {
          Object.assign(props, {
            tn: d.tn,
            rtn: d.rtn,
            cn: d.cn,
            rcn: d.rcn,
            relation_type: d.relationType,
          });
        }
        for (const role of Object.keys(d.disabled)) {
          const dataInDb = await this.xcMeta.metaGet(
            this.getProjectId(args),
            this.getDbAlias(args),
            'nc_disabled_models_for_role',
            {
              type: args.args.type,
              title: d[field],
              role,
              ...props,
            }
          );
          if (dataInDb) {
            if (d.disabled[role]) {
              if (!dataInDb.disabled) {
                await this.xcMeta.metaUpdate(
                  this.getProjectId(args),
                  this.getDbAlias(args),
                  'nc_disabled_models_for_role',
                  {
                    disabled: d.disabled[role],
                  },
                  {
                    type: args.args.type,
                    title: d[field],
                    role,
                    ...props,
                  }
                );
              }
            } else {
              await this.xcMeta.metaDelete(
                this.getProjectId(args),
                this.getDbAlias(args),
                'nc_disabled_models_for_role',
                {
                  type: args.args.type,
                  title: d[field],
                  role,
                  ...props,
                }
              );
            }
          } else if (d.disabled[role]) {
            await this.xcMeta.metaInsert(
              this.getProjectId(args),
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                disabled: d.disabled[role],
                type: args.args.type,
                title: d[field],
                role,
                ...props,
              }
            );
          }
        }
      }
    } catch (e) {
      throw e;
    }
  }

  protected async xcVisibilityMetaSetAll(args) {
    try {
      for (const d of args.args.disableList) {
        const field = 'tn';
        const props = {};

        for (const role of Object.keys(d.disabled)) {
          const dataInDb = await this.xcMeta.metaGet(
            this.getProjectId(args),
            this.getDbAlias(args),
            'nc_disabled_models_for_role',
            {
              type: d.type,
              title: d[field],
              role,
              parent_model_title: d.ptn,
              ...props,
            }
          );
          if (dataInDb) {
            if (d.disabled[role]) {
              if (!dataInDb.disabled) {
                await this.xcMeta.metaUpdate(
                  this.getProjectId(args),
                  this.getDbAlias(args),
                  'nc_disabled_models_for_role',
                  {
                    disabled: d.disabled[role],
                  },
                  {
                    parent_model_title: d.ptn,
                    type: d.type,
                    title: d[field],
                    role,
                    ...props,
                  }
                );
              }
            } else {
              await this.xcMeta.metaDelete(
                this.getProjectId(args),
                this.getDbAlias(args),
                'nc_disabled_models_for_role',
                {
                  parent_model_title: d.ptn,
                  type: d.type,
                  title: d[field],
                  role,
                  ...props,
                }
              );
            }
          } else if (d.disabled[role]) {
            await this.xcMeta.metaInsert(
              this.getProjectId(args),
              this.getDbAlias(args),
              'nc_disabled_models_for_role',
              {
                parent_model_title: d.ptn,
                disabled: d.disabled[role],
                type: d.type,
                title: d[field],
                role,
                ...props,
              }
            );
          }
        }
      }
    } catch (e) {
      throw e;
    }
  }

  protected async xcAuditList(args): Promise<any> {
    return this.xcMeta.metaPaginatedList(
      this.getProjectId(args),
      null,
      'nc_audit',
      {
        limit: args.args.limit,
        offset: args.args.offset,
        sort: {
          field: 'created_at',
          desc: true,
        },
      }
    );
  }

  protected async xcTableModelsEnable(args): Promise<any> {
    const dbAlias = this.getDbAlias(args);

    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: true,
      },
      null,
      {
        title: {
          in: args.args,
        },
        type: {
          eq: 'table',
        },
      }
    );

    await this.xcMeta.metaUpdate(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        enabled: false,
      },
      null,
      {
        title: {
          nin: args.args,
        },
        type: {
          eq: 'table',
        },
      }
    );
  }

  // NOTE: updated
  protected async xcRelationsSet(args): Promise<any> {
    // const client = await this.projectGetSqlClient(args);
    const dbAlias = await this.getDbAlias(args);

    // filter out model names which toggled
    const metaTableNames = [
      ...new Set(
        args.args.map((rel) => {
          return rel.relationType === 'hm' ? rel.rtn : rel.tn;
        })
      ),
    ];

    // get current meta from db
    // const metas = await client.knex('nc_models').select('meta', 'id', 'title').whereIn('title', metaTableNames);
    const metas = await this.xcMeta.metaList(
      args.project_id,
      dbAlias,
      'nc_models',
      {
        xcCondition: {
          title: {
            in: metaTableNames,
          },
        },
      }
    );

    const metaMap: {
      [key: string]: any;
    } = {};

    for (const { meta, id, title } of metas) {
      metaMap[title] = {
        id,
        meta: JSON.parse(meta),
      };
    }

    // todo: handle if there is multiple relations between same tables(by comparing column names)
    for (const rel of args.args) {
      if (rel.relationType === 'hm') {
        const relation = metaMap[rel.rtn].meta.hasMany.find(
          (hmRel) => hmRel.tn === rel.tn
        );
        relation.enabled = rel.enabled;
      } else {
        const relation = metaMap[rel.tn].meta.belongsTo.find(
          (btRel) => btRel.rtn === rel.rtn
        );
        relation.enabled = rel.enabled;
      }
    }

    try {
      await this.xcMeta.startTransaction();
      for (const { id, meta } of Object.values(metaMap)) {
        await this.xcMeta.metaUpdate(
          args.project_id,
          dbAlias,
          'nc_models',
          {
            meta: JSON.stringify(meta),
          },
          id
        );
      }
      await this.xcMeta.commit();
    } catch (e) {
      this.xcMeta.rollback(e);
      throw e;
    }
  }
}
