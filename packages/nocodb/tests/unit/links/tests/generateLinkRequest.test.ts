// test for generateLinkRequest method on src/db/links/requestHandler.ts
import 'mocha';
import { expect } from 'chai';
import { initInitialModel } from '../initModel';
import type { ITestContext } from '../initModel';
import { LinksRequestHandler } from '~/db/links/requestHandler';

function linksGenerateLinkRequestTests() {
  let _setup: ITestContext;
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _tables: any;
  let _linkColumns: any;
  let _baseModelSql;
  let linksRequestHandler: LinksRequestHandler;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
    _linkColumns = setup.linkColumns;
    linksRequestHandler = new LinksRequestHandler();
  });

  describe('generateLinkRequest', () => {
    it('should generate link request for HM (Has Many) relation', async () => {
      const { table1, table2 } = _tables;
      const { t2_HM_t1_Ltar } = _linkColumns;

      const payload = {
        modelId: table2.id,
        columnId: t2_HM_t1_Ltar.id,
        links: [
          { rowId: '1', linkIds: new Set(['1', '2', '3']) },
          { rowId: '2', linkIds: new Set(['4', '5']) },
        ],
      };

      const result = await linksRequestHandler.generateLinkRequest(
        _ctx,
        payload,
      );

      expect(result.links).to.have.lengthOf(0); // Already linked
      expect(result.unlinks).to.have.lengthOf(0); // nothing to unlink
    });

    it('should generate link request for MM (Many to Many) relation', async () => {
      const { table1, table2 } = _tables;
      const { t1_MM_t2_Ltar } = _linkColumns;

      const payload = {
        modelId: table1.id,
        columnId: t1_MM_t2_Ltar.id,
        links: [
          { rowId: '1', linkIds: new Set(['1', '2']) },
          { rowId: '2', linkIds: new Set(['3']) },
        ],
      };

      const result = await linksRequestHandler.generateLinkRequest(
        _ctx,
        payload,
      );

      expect(result.links).to.have.lengthOf(2);
      expect(result.links[0].rowId).to.equal('1');
      expect(result.links[0].linkIds.size).to.equal(2);
      expect(result.links[1].rowId).to.equal('2');
      expect(result.links[1].linkIds.size).to.equal(1);
      expect(result.unlinks).to.be.undefined;
    });

    it('should generate link request for OO (One to One) relation', async () => {
      const { table1, table3 } = _tables;
      const { t1_OO_t3_Ltar } = _linkColumns;

      const payload = {
        modelId: table1.id,
        columnId: t1_OO_t3_Ltar.id,
        links: [{ rowId: '1', linkIds: new Set(['1']) }],
      };

      const result = await linksRequestHandler.generateLinkRequest(
        _ctx,
        payload,
      );

      expect(result.links).to.have.lengthOf(1);
      expect(result.links[0].rowId).to.equal('1');
      expect(result.links[0].linkIds.size).to.equal(1);
      expect(result.unlinks).to.be.undefined;
    });

    it('should generate link request for BT (Belongs To) relation', async () => {
      const { table1, table4 } = _tables;
      const { t4_BT_t3_Ltar } = _linkColumns;

      const payload = {
        modelId: table4.id,
        columnId: t4_BT_t3_Ltar.id,
        links: [{ rowId: '1', linkIds: new Set(['1']) }],
      };

      const result = await linksRequestHandler.generateLinkRequest(
        _ctx,
        payload,
      );
      expect(result.links).to.have.lengthOf(0); // already linked
    });
  });
}

export function linksGenerateLinkRequestTest() {
  describe('LinksGenerateLinkRequestTest', linksGenerateLinkRequestTests);
}
