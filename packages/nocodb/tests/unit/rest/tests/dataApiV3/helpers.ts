import { expect } from 'chai';
import request from 'supertest';
import { type ColumnType, WorkspaceUserRoles } from 'nocodb-sdk';
import { defaultUserArgs } from '../../../factory/user';
import type init from '../../../init';
import type { Base, Model } from '../../../../../src/models';

export interface ITestContext {
  context: Awaited<ReturnType<typeof init>>;
  ctx: {
    workspace_id: any;
    base_id: any;
  };
  sakilaProject: Base;
  base: Base;
  countryTable: Model;
  cityTable: Model;
}

export const normalizeObject = (obj) => {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
};

export const verifyColumnsInRsp = (
  row: Record<string, any>,
  columns: ColumnType[],
) => {
  const responseColumnsListStr = Object.keys(row).sort().join(',');
  const expectedColumnsListStr = columns
    .filter((c) => !c.system || c.pk)
    .map((c) => c.title)
    .sort()
    .join(',');

  return responseColumnsListStr === expectedColumnsListStr;
};

export function prepareRecords(
  title: string,
  count: number,
  start: number = 1,
  option?: {
    ignoreId: boolean;
  },
) {
  const records: Record<string, string | number>[] = [];
  for (let i = start; i <= start + count - 1; i++) {
    records.push({
      ...(option?.ignoreId ? {} : { Id: i }),
      [title]: `${title} ${i}`,
    });
  }
  return records;
}

export function getColumnId(columns: ColumnType[], title: string) {
  return columns.find((c) => c.title === title)!.id!;
}
export const idc = (r1: any, r2: any) => r1.Id - r2.Id;

export function initArraySeq(i: number, count: number) {
  return Array.from({ length: count }, (_, index) => i + index);
}

export async function addUsers(
  testContext: ITestContext,
  email: string,
  displayName?: string,
) {
  const response = await request(testContext.context.app)
    .post('/api/v1/auth/user/signup')
    .send({
      email,
      password: defaultUserArgs.password,
      display_name: displayName,
    })
    .expect(200);

  const token = response.body.token;
  expect(token).to.be.a('string');

  // invite users to workspace
  if (process.env.EE === 'true') {
    const _rsp = await request(testContext.context.app)
      .post(
        `/api/v1/workspaces/${testContext.context.fk_workspace_id}/invitations`,
      )
      .set('xc-auth', testContext.context.token)
      .send({ email, roles: WorkspaceUserRoles.VIEWER });
    // console.log(rsp);
  }
}

export async function getUsers(testContext: ITestContext) {
  const response = await request(testContext.context.app)
    .get(`/api/v2/meta/bases/${testContext.base.id}/users`)
    .set('xc-auth', testContext.context.token);

  expect(response.body).to.have.keys(['users']);
  expect(response.body.users.list).to.have.length(6);
  return response.body.users.list;
}
