import { expect } from 'chai';
import { isEE } from 'playwright/setup/db';
import { type INcAxios, ncAxios } from '../dataApiV3/ncAxios';
import { beforeEach as initBeforeEach } from './beforeEach';
import type { ITestContext } from './helpers';

export function paymentTest() {
  if (!isEE()) {
    return true;
  }
  describe(`Payment`, () => {
    let testContext: ITestContext;
    let testAxios: INcAxios;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];
    let ncAxiosPatch: INcAxios['ncAxiosPatch'];
    let ncAxiosDelete: INcAxios['ncAxiosDelete'];
    let ncAxiosLinkGet: INcAxios['ncAxiosLinkGet'];
    let ncAxiosLinkAdd: INcAxios['ncAxiosLinkAdd'];
    let ncAxiosLinkRemove: INcAxios['ncAxiosLinkRemove'];

    beforeEach(async () => {
      testContext = await initBeforeEach();
      testAxios = ncAxios(testContext);

      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
      ncAxiosPatch = testAxios.ncAxiosPatch;
      ncAxiosDelete = testAxios.ncAxiosDelete;
      ncAxiosLinkGet = testAxios.ncAxiosLinkGet;
      ncAxiosLinkAdd = testAxios.ncAxiosLinkAdd;
      ncAxiosLinkRemove = testAxios.ncAxiosLinkRemove;
    });

    it(`will get public plans`, async () => {
      const result = await ncAxiosGet({
        url: '/api/public/payment/plan',
      });
      expect(Array.isArray(result.body)).to.eq(true);
    });
    it(`will get workspace invoices without subscription`, async () => {
      const result = await ncAxiosGet({
        url: `/api/payment/${testContext.ctx.workspace_id}/invoice`,
        status: 404,
      });
      expect(result.body.error).to.eq('GENERIC_NOT_FOUND');
      expect(result.body.message).to.eq(
        `Subscription '${testContext.ctx.workspace_id}' not found`,
      );
    });
  });
}
