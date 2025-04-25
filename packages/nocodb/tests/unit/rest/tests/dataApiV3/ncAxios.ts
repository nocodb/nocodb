import request from 'supertest';
import { expect } from 'chai';
import type { ITestContext } from './beforeEach';

export interface INcAxios {
  ncAxiosGet: ({
    url,
    query,
    status,
  }: {
    url: string;
    query?: any;
    status?: number;
  }) => Promise<request.Response>;
  ncAxiosPost: ({
    url,
    body,
    status,
    query,
  }: {
    url: string;
    body?: any;
    status?: number;
    query?: any;
  }) => Promise<request.Response>;
  ncAxiosPatch: ({
    url,
    body,
    status,
  }: {
    url: string;
    body?: any;
    status?: number;
  }) => Promise<request.Response>;
  ncAxiosDelete: ({
    url,
    body,
    status,
  }: {
    url: string;
    body?: any;
    status?: number;
  }) => Promise<request.Response>;
  ncAxiosLinkGet: ({
    urlParams,
    query,
    status,
    msg,
  }: {
    urlParams: { tableId: string; linkId: string; rowId: string };
    query?: any;
    status?: number;
    msg?: string;
  }) => Promise<request.Response>;

  ncAxiosLinkAdd: ({
    urlParams,
    body,
    status,
    msg,
  }: {
    urlParams: { tableId: string; linkId: string; rowId: string };
    body?: any;
    status?: number;
    msg?: string;
  }) => Promise<request.Response>;

  ncAxiosLinkRemove: ({
    urlParams,
    body,
    status,
    msg,
  }: {
    urlParams: { tableId: string; linkId: string; rowId: string };
    body?: any;
    status?: number;
    msg?: string;
  }) => Promise<request.Response>;
}

export const ncAxios = (testContext: ITestContext) => {
  async function ncAxiosGet({
    url,
    query = {},
    status = 200,
  }: {
    url: string;
    query?: any;
    status?: number;
  }) {
    const response = await request(testContext.context.app)
      .get(url)
      .set('xc-auth', testContext.context.token)
      .query(query)
      .send({});

    expect(response.status).to.equal(status);
    return response;
  }

  async function ncAxiosPost({
    url,
    body = {},
    status = 200,
    query = {},
  }: {
    url: string;
    body?: any;
    status?: number;
    query?: any;
  }) {
    const response = await request(testContext.context.app)
      .post(url)
      .set('xc-auth', testContext.context.token)
      .query(query)
      .send(body);
    expect(response.status).to.equal(status);
    return response;
  }

  async function ncAxiosPatch({
    url,
    body = {},
    status = 200,
  }: {
    url: string;
    body?: any;
    status?: number;
  }) {
    const response = await request(testContext.context.app)
      .patch(url)
      .set('xc-auth', testContext.context.token)
      .send(body);
    expect(response.status).to.equal(status);
    return response;
  }

  async function ncAxiosDelete({
    url,
    body = {},
    status = 200,
  }: {
    url: string;
    body?: any;
    status?: number;
  }) {
    const response = await request(testContext.context.app)
      .delete(url)
      .set('xc-auth', testContext.context.token)
      .send(body);
    expect(response.status).to.equal(status);
    return response;
  }

  async function ncAxiosLinkGet({
    urlParams,
    query = {},
    status = 200,
    msg,
  }: {
    urlParams: { tableId: string; linkId: string; rowId: string };
    query?: any;
    status?: number;
    msg?: string;
  }) {
    const url = `/api/v3/${testContext.base.id}/${urlParams.tableId}/links/${urlParams.linkId}/${urlParams.rowId}`;
    const response = await request(testContext.context.app)
      .get(url)
      .set('xc-auth', testContext.context.token)
      .query(query)
      .send({});
    expect(response.status).to.equal(status);

    if (msg) {
      expect(response.body.message || response.body.msg).to.equal(msg);
    }

    return response;
  }

  async function ncAxiosLinkAdd({
    urlParams,
    body = {},
    status = 200,
    msg,
  }: {
    urlParams: { tableId: string; linkId: string; rowId: string };
    body?: any;
    status?: number;
    msg?: string;
  }) {
    const url = `/api/v3/${testContext.base.id}/${urlParams.tableId}/links/${urlParams.linkId}/${urlParams.rowId}`;
    const response = await request(testContext.context.app)
      .post(url)
      .set('xc-auth', testContext.context.token)
      .send(body);

    expect(response.status).to.equal(status);
    if (msg) {
      expect(response.body.message || response.body.msg).to.equal(msg);
    }
    return response;
  }

  async function ncAxiosLinkRemove({
    urlParams,
    body = {},
    status = 200,
    msg,
  }: {
    urlParams: { tableId: string; linkId: string; rowId: string };
    body?: any;
    status?: number;
    msg?: string;
  }) {
    const url = `/api/v3/${testContext.base.id}/${urlParams.tableId}/links/${urlParams.linkId}/${urlParams.rowId}`;
    const response = await request(testContext.context.app)
      .delete(url)
      .set('xc-auth', testContext.context.token)
      .send(body);

    expect(response.status).to.equal(status);
    if (msg) {
      expect(response.body.message || response.body.msg).to.equal(msg);
    }
    return response;
  }

  return {
    ncAxiosGet,
    ncAxiosPost,
    ncAxiosPatch,
    ncAxiosDelete,
    ncAxiosLinkGet,
    ncAxiosLinkAdd,
    ncAxiosLinkRemove,
  } as INcAxios;
};
