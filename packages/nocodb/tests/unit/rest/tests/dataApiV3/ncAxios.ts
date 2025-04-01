import request from 'supertest';
import { expect } from 'chai';
import type init from '../../../init';

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
}

export const ncAxios = (context: Awaited<ReturnType<typeof init>>) => {
  async function ncAxiosGet({
    url,
    query = {},
    status = 200,
  }: {
    url: string;
    query?: any;
    status?: number;
  }) {
    const response = await request(context.app)
      .get(url)
      .set('xc-auth', context.token)
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
    const response = await request(context.app)
      .post(url)
      .set('xc-auth', context.token)
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
    const response = await request(context.app)
      .patch(url)
      .set('xc-auth', context.token)
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
    const response = await request(context.app)
      .delete(url)
      .set('xc-auth', context.token)
      .send(body);
    expect(response.status).to.equal(status);
    return response;
  }

  return {
    ncAxiosGet,
    ncAxiosPost,
    ncAxiosPatch,
    ncAxiosDelete,
  } as INcAxios;
};
