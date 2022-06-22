'use strict';

import rewire from 'rewire';
import sinon from 'sinon';
import { expect } from 'chai';
import Base from '../../../../../../lib/models/Base';
import Model from '../../../../../../lib/models/Model';
import NcConnectionMgrv2 from '../../../../../../lib/utils/common/NcConnectionMgrv2';
import * as getAstObject from '../../../../../../lib/db/sql-data-mapper/lib/sql/helpers/getAst';

const dataAliasApis = rewire(
  '../../../../../../lib/meta/api/dataApis/dataAliasApis'
);
const getFindOne = dataAliasApis.__get__('getFindOne');

describe('getFindOne', () => {
  const model = {
    id: 'modelId',
    base_id: 'baseId'
  };
  const view = {
    id: 'viewId'
  };
  const base = {
    id: 'baseId'
  };
  const dbDriver = {
    id: 'dbDriverId'
  };
  const req = { query: {} };
  const baseModel = {
    findOne: sinon.fake.returns(undefined)
  };
  const baseGetFake = sinon.replace(Base, 'get', sinon.fake.returns(base));
  const baseModelFake = sinon.replace(
    Model,
    'getBaseModelSQL',
    sinon.fake.returns(baseModel)
  );
  sinon.replace(NcConnectionMgrv2, 'get', sinon.fake.returns(dbDriver));
  const getAstFake = sinon.fake.returns({ id: 1 });
  sinon.replace(getAstObject, 'default', getAstFake);

  it('calls Base.get to find base', async () => {
    await getFindOne(model, view, req);
    expect(baseGetFake.calledWith(model.base_id)).to.be.true;
  });

  it('call Model.getBaseModelSQL to find baseModel', async () => {
    await getFindOne(model, view, req);
    expect(
      baseModelFake.calledWith({
        id: model.id,
        viewId: view.id,
        dbDriver: dbDriver
      })
    ).to.be.true;
  });

  it('calls baseModel.findOne', async () => {
    await getFindOne(model, view, req);
    expect(baseModel.findOne.calledWith({ ...req.query })).to.be.true;
  });

  describe('when data is not found', () => {
    it('should return empty object', async () => {
      expect(await getFindOne(model, view, req)).to.be.empty;
    });
  });

  describe('when data is found', () => {
    it('returns data', async () => {
      const findOneResult = {
        id: 'dataId'
      };
      baseModel.findOne = sinon.fake.returns(findOneResult);
      expect(await getFindOne(model, view, req)).eql(findOneResult);
    });
  });
});