import Handlebars from 'handlebars';
import { IWebhookNotificationAdapter } from 'nc-plugin';
import ejs from 'ejs';
import IEmailAdapter from '../../../interface/IEmailAdapter';
import { BaseModelSql } from '../../db/sql-data-mapper';

// import axios from "axios";
import BaseApiBuilder from './BaseApiBuilder';
import formSubmissionEmailTemplate from './formSubmissionEmailTemplate';

Handlebars.registerHelper('json', function (context) {
  return JSON.stringify(context);
});

class BaseModel<T extends BaseApiBuilder<any>> extends BaseModelSql {
  private builder: T;

  constructor(args: any, builder: T) {
    super(args);
    this.builder = builder;
  }

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.insert', data, req);
  }

  public async afterInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('after.insert', data, req);
    const id = this._extractPksValues(data);
    this.builder
      .getXcMeta()
      .audit(
        this.builder?.getProjectId(),
        this.builder?.getDbAlias(),
        'nc_audit',
        {
          model_name: this._tn,
          model_id: id,
          op_type: 'DATA',
          op_sub_type: 'INSERT',
          description: `${id} inserted into ${this._tn}`,
          // details: JSON.stringify(data),
          ip: req?.clientIp,
          user: req?.user?.email,
        }
      );
  }

  public async beforeUpdate(data: any, _trx: any, req): Promise<void> {
    req = req || {};
    req['oldData'] = await this.readByPk(req['params'].id);
    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('before.update', data, req);
    }
  }

  public async afterUpdate(data: any, _trx: any, req): Promise<void> {
    this.builder
      .getXcMeta()
      .audit(
        this.builder?.getProjectId(),
        this.builder?.getDbAlias(),
        'nc_audit',
        {
          model_name: this._tn,
          model_id: req['params'].id,
          op_type: 'DATA',
          op_sub_type: 'UPDATE',
          description: this._updateAuditDescription(
            req['params'].id,
            req['oldData'],
            req['body']
          ),
          details: this._updateAuditDetails(req['oldData'], req['body']),
          ip: req.clientIp,
          user: req.user?.email,
        }
      );
    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('after.update', data, req);
    }
  }

  private _updateAuditDescription(id, oldData: any, data: any) {
    return `Table ${this._tn} : ${id} ${(() => {
      const keys = Object.keys(data);
      const result = [];
      keys.forEach((key) => {
        if (oldData[key] !== data[key]) {
          result.push(
            `field ${key} got changed from ${oldData[key]} to ${data[key]}`
          );
        }
      });
      return result.join(',\n');
    })()}`;
  }

  private _updateAuditDetails(oldData: any, data: any) {
    return (() => {
      const keys = Object.keys(data);
      const result = [];
      keys.forEach((key) => {
        if (oldData[key] !== data[key]) {
          result.push(`<span class="">${key}</span>
          : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${oldData[key]}</span>
          <span class="black--text green lighten-4 px-2">${data[key]}</span>`);
        }
      });
      return result.join(',<br/>');
    })();
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.delete', data, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    this.builder
      .getXcMeta()
      .audit(
        this.builder?.getProjectId(),
        this.builder?.getDbAlias(),
        'nc_audit',
        {
          model_name: this._tn,
          model_id: req?.params?.id,
          op_type: 'DATA',
          op_sub_type: 'DELETE',
          description: `${req?.params.id} deleted from ${this._tn}`,
          ip: req?.clientIp,
          user: req?.user?.email,
        }
      );
    await this.handleHooks('after.delete', data, req);
  }

  private async handleHooks(hookName, data, req): Promise<void> {
    // const data = _data;

    // handle form view data submission
    if (
      hookName === 'after.insert' &&
      req?.query?.form &&
      this.builder?.formViews?.[this.tn]?.[req.query.form]
    ) {
      const formView = this.builder?.formViews?.[this.tn]?.[req.query.form];
      const emails = Object.entries(
        formView?.query_params?.extraViewParams?.formParams?.emailMe || {}
      )
        .filter((a) => a[1])
        .map((a) => a[0]);
      if (emails?.length) {
        const transformedData = this._transformSubmittedFormDataForEmail(
          data,
          formView
        );
        // todo: notification template
        this.emailAdapter?.mailSend({
          to: emails.join(','),
          subject: this.parseBody('NocoDB Form', req, data, {}),
          html: ejs.render(formSubmissionEmailTemplate, {
            data: transformedData,
            tn: this.tn,
            _tn: this._tn,
          }),
        });
      }
    }

    try {
      if (
        this.tn in this.builder.hooks &&
        hookName in this.builder.hooks[this.tn] &&
        this.builder.hooks[this.tn][hookName]
      ) {
        /*        if (hookName === 'after.update') {
                  try {
                    data = await this.nestedRead(req.params.id, this.defaultNestedQueryParams)
                  } catch (_) {
                    /!* ignore *!/
                  }
                }*/

        for (const hook of this.builder.hooks[this.tn][hookName]) {
          if (!hook.active) {
            continue;
          }
          console.log(
            'Hook handler ::::' + this.tn + '::::',
            this.builder.hooks[this.tn][hookName]
          );
          console.log('Hook handler ::::' + this.tn + '::::', data);

          if (!this.validateCondition(hook.condition, data, req)) {
            continue;
          }

          switch (hook.notification?.type) {
            case 'Email':
              this.emailAdapter?.mailSend({
                to: this.parseBody(
                  hook.notification?.payload?.to,
                  req,
                  data,
                  hook.notification?.payload
                ),
                subject: this.parseBody(
                  hook.notification?.payload?.subject,
                  req,
                  data,
                  hook.notification?.payload
                ),
                html: this.parseBody(
                  hook.notification?.payload?.body,
                  req,
                  data,
                  hook.notification?.payload
                ),
              });
              break;
            case 'URL':
              this.handleHttpWebHook(hook.notification?.payload, req, data);
              break;
            default:
              if (
                this.webhookNotificationAdapters &&
                hook.notification?.type &&
                hook.notification?.type in this.webhookNotificationAdapters
              ) {
                this.webhookNotificationAdapters[
                  hook.notification.type
                ].sendMessage(
                  this.parseBody(
                    hook.notification?.payload?.body,
                    req,
                    data,
                    hook.notification?.payload
                  ),
                  JSON.parse(
                    JSON.stringify(hook.notification?.payload),
                    (_key, value) => {
                      return typeof value === 'string'
                        ? this.parseBody(
                            value,
                            req,
                            data,
                            hook.notification?.payload
                          )
                        : value;
                    }
                  )
                );
              }
              break;
          }

          // await axios.post(this.builder.hooks[this.tn][hookName].url, {data}, {
          //   headers: req?.headers
          // })
        }
      }
    } catch (e) {
      console.log('hooks :: error', hookName, e.message);
    }
  }

  private _transformSubmittedFormDataForEmail(data, formView) {
    const transformedData = { ...data };
    for (const col of this.columns) {
      if (!formView.query_params?.showFields?.[col._cn]) {
        delete transformedData[col._cn];
        continue;
      }

      if (col.uidt === 'Attachment') {
        if (typeof transformedData[col._cn] === 'string') {
          transformedData[col._cn] = JSON.parse(transformedData[col._cn]);
        }
        transformedData[col._cn] = (transformedData[col._cn] || [])
          .map((attachment) => {
            if (
              [
                'jpeg',
                'gif',
                'png',
                'apng',
                'svg',
                'bmp',
                'ico',
                'jpg',
                'webp',
              ].includes(attachment.title.split('.').pop())
            ) {
              return `<a href="${attachment.url}" target="_blank"><img height="50px" src="${attachment.url}"/></a>`;
            }
            return `<a href="${attachment.url}" target="_blank">${attachment.title}</a>`;
          })
          .join('&nbsp;');
      } else if (
        transformedData[col._cn] &&
        typeof transformedData[col._cn] === 'object'
      ) {
        transformedData[col._cn] = JSON.stringify(transformedData[col._cn]);
      }
    }

    for (const virtual of this.virtualColumns) {
      const hidden = !formView.query_params?.showFields?.[virtual._cn];

      if (virtual.bt) {
        const prop = `${virtual.bt._rtn}Read`;
        if (hidden) {
          delete transformedData[prop];
        } else {
          transformedData[prop] =
            transformedData?.[prop]?.[
              this.builder
                .getMeta(virtual.bt.rtn)
                ?.columns?.find((c) => c.pv)?._cn
            ];
        }
      } else if (virtual.hm) {
        const prop = `${virtual.hm._tn}List`;
        if (hidden) {
          delete transformedData[prop];
        } else {
          transformedData[prop] = transformedData?.[prop]
            ?.map(
              (r) =>
                r[
                  this.builder
                    .getMeta(virtual.hm.tn)
                    ?.columns?.find((c) => c.pv)?._cn
                ]
            )
            .join(', ');
        }
      } else if (virtual.mm) {
        const prop = `${virtual.mm._rtn}MMList`;
        if (hidden) {
          delete transformedData[prop];
        } else {
          transformedData[prop] = transformedData?.[prop]
            ?.map(
              (r) =>
                r[
                  this.builder
                    .getMeta(virtual.mm.tn)
                    ?.columns?.find((c) => c.pv)?._cn
                ]
            )
            .join(', ');
        }
      }
    }

    return transformedData;
  }

  private async handleHttpWebHook(apiMeta, apiReq, data) {
    try {
      const req = this.axiosRequestMake(apiMeta, apiReq, data);
      await require('axios')(req);
    } catch (e) {
      console.log(e);
    }
  }

  private axiosRequestMake(_apiMeta, apiReq, data) {
    const apiMeta = { ..._apiMeta };
    if (apiMeta.body) {
      try {
        apiMeta.body = JSON.parse(apiMeta.body, (_key, value) => {
          return typeof value === 'string'
            ? this.parseBody(value, apiReq, data, apiMeta)
            : value;
        });
      } catch (e) {
        apiMeta.body = this.parseBody(apiMeta.body, apiReq, data, apiMeta);
        console.log(e);
      }
    }
    if (apiMeta.auth) {
      try {
        apiMeta.auth = JSON.parse(apiMeta.auth, (_key, value) => {
          return typeof value === 'string'
            ? this.parseBody(value, apiReq, data, apiMeta)
            : value;
        });
      } catch (e) {
        apiMeta.auth = this.parseBody(apiMeta.auth, apiReq, data, apiMeta);
        console.log(e);
      }
    }
    apiMeta.response = {};
    const req = {
      params: apiMeta.parameters
        ? apiMeta.parameters.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = this.parseBody(
                param.value,
                apiReq,
                data,
                apiMeta
              );
            }
            return paramsObj;
          }, {})
        : {},
      url: this.parseBody(apiMeta.path, apiReq, data, apiMeta),
      method: apiMeta.method,
      data: apiMeta.body,
      headers: apiMeta.headers
        ? apiMeta.headers.reduce((headersObj, header) => {
            if (header.name && header.enabled) {
              headersObj[header.name] = this.parseBody(
                header.value,
                apiReq,
                data,
                apiMeta
              );
            }
            return headersObj;
          }, {})
        : {},
      withCredentials: true,
    };
    return req;
  }

  // @ts-ignore
  private get emailAdapter(): IEmailAdapter {
    return this.builder?.app?.metaMgr?.emailAdapter;
  }

  // @ts-ignore
  private get webhookNotificationAdapters(): {
    [key: string]: IWebhookNotificationAdapter;
  } {
    return this.builder?.app?.metaMgr?.webhookNotificationAdapters;
  }

  private validateCondition(condition: any, data: any, _req: any) {
    if (!condition || !condition.length) {
      return true;
    }

    const isValid = condition.reduce((valid, con) => {
      let res;
      const field = this.columnToAlias[con.field] ?? con.field;
      let val = data[field];
      switch (typeof con.value) {
        case 'boolean':
          val = !!data[field];
          break;
        case 'number':
          val = !!data[field];
          break;
      }
      switch (con.op as string) {
        case 'is equal':
          res = val === con.value;
          break;
        case 'is not equal':
          res = val !== con.value;
          break;
        case 'is like':
          res =
            data[field]?.toLowerCase()?.indexOf(con.value?.toLowerCase()) > -1;
          break;
        case 'is not like':
          res =
            data[field]?.toLowerCase()?.indexOf(con.value?.toLowerCase()) ===
            -1;
          break;
        case 'is empty':
          res =
            data[field] === '' ||
            data[field] === null ||
            data[field] === undefined;
          break;
        case 'is not empty':
          res = !(
            data[field] === '' ||
            data[field] === null ||
            data[field] === undefined
          );
          break;
        case 'is null':
          res = res = data[field] === null;
          break;
        case 'is not null':
          res = data[field] !== null;
          break;

        /*   todo:     case '<':
                  return condition + `~not(${filt.field},lt,${filt.value})`;
                case '<=':
                  return condition + `~not(${filt.field},le,${filt.value})`;
                case '>':
                  return condition + `~not(${filt.field},gt,${filt.value})`;
                case '>=':
                  return condition + `~not(${filt.field},ge,${filt.value})`;*/
      }

      return con.logicOp === 'or' ? valid || res : valid && res;
    }, true);

    return isValid;
  }

  private parseBody(
    template: string,
    req: any,
    data: any,
    payload: any
  ): string {
    if (!template) {
      return template;
    }

    return Handlebars.compile(template, { noEscape: true })({
      data,
      user: req?.user,
      payload,
      env: process.env,
    });
  }
}

export default BaseModel;
