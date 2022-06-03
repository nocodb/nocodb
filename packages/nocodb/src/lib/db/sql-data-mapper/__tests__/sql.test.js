const {expect} = require('chai');

const models = require('./models')

const country = models.country;

const city = models.city;


//desribe group of tests done
describe('xc-data-mapper tests', function () {

  before(function (done) {
    //start appln
    done();
  });

  after(function (done) {
    //stop appln

    done();
  });

  beforeEach(function (done) {
    //init common variables for each test

    done();
  });

  afterEach(function (done) {
    //term common variables for each test

    done();
  });

  it('create, read, update, delete', async function () {

    let data = await country.insert({country: 'xc'});
    expect(data['country']).to.equal('xc');

    data = await country.readByPk(data.country_id);
    expect(data['country']).to.equal('xc');

    data.country = 'xgc'
    const updated = await country.updateByPk(data.country_id, data);
    expect(updated).to.equal(1);

    data.country = 'xgc'
    const deleted = await country.delByPk(data.country_id);
    expect(deleted).to.equal(1);

  });

  it('create : transaction + commit', async function () {

    let trx = null;

    try {

      trx = await country.transaction();

      let data = await country.insert({country: 'xc'}, trx);
      expect(data['country']).to.equal('xc');

      let find = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(find['country']).to.equal(undefined);

      await country.commit(trx);

      data = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(data['country']).to.equal(data.country);

      const deleted = await country.delByPk(data.country_id);
      expect(deleted).to.equal(1);


    } catch (e) {
      if (trx)
        await country.rollback(trx)
      console.log(e);
      throw e;
    }

  });

  it('create: transaction + rollback ', async function () {

    let trx = null;
    let data = null;
    try {

      trx = await country.transaction();

      data = await country.insert({country: 'xc'}, trx);
      expect(data['country']).to.equal('xc');

      data = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(data['country']).to.equal(undefined);

      await country.rollback(trx);

      data = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(data['country']).to.equal(undefined);

    } catch (e) {
      await country.rollback(trx)
      console.log(e);
      throw e;
    } finally {

    }

  });

  it('update : transaction + commit', async function () {

    let trx = null;
    let data = null;
    try {

      let data = await country.insert({country: 'xc'});

      trx = await country.transaction();
      data.country = 'xgc'
      const updated = await country.updateByPk(data.country_id, data, trx);

      await country.commit(trx);

      data = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(data['country']).to.equal('xgc');

    } catch (e) {
      await country.rollback(trx)
      console.log(e);
      throw e;
    } finally {
      if (data)
        await country.delByPk(data.country_id);
    }

  });

  it('update: transaction + rollback ', async function () {

    let trx = null;
    let data = null;
    try {

      let data = await country.insert({country: 'xc'});

      trx = await country.transaction();
      data.country = 'xgc'
      const updated = await country.updateByPk(data.country_id, data, trx);

      await country.rollback(trx);

      data = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(data['country']).to.equal('xc');

    } catch (e) {
      await country.rollback(trx)
      console.log(e);
      throw e;
    } finally {
      if (data)
        await country.delByPk(data.country_id);
    }

  });

  it('delete : transaction + commit', async function () {

    let trx = null;
    let data = null;
    try {

      let data = await country.insert({country: 'xc'});

      trx = await country.transaction();
      const deleted = await country.delByPk(data.country_id, trx);

      await country.commit(trx);

      data = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(data['country']).to.equal(undefined);

      data = null;

    } catch (e) {
      await country.rollback(trx)
      console.log(e);
      throw e;
    } finally {
      if (data)
        await country.delByPk(data.country_id);
    }

  });

  it('delete: transaction + rollback ', async function () {

    let trx = null;
    let data = null;
    try {

      let data = await country.insert({country: 'xc'});

      trx = await country.transaction();
      const deleted = await country.delByPk(data.country_id, trx);

      await country.rollback(trx);

      data = await country.findOne({where: `(country_id,eq,${data.country_id})`});
      expect(data['country']).to.equal('xc');

    } catch (e) {
      await country.rollback(trx)
      console.log(e);
      throw e;
    } finally {
      if (data)
        await country.delByPk(data.country_id);
    }

  });


  it('read invalid', async function () {
    data = await country.readByPk('xys');
    expect(Object.keys(data).length).to.equal(0);
  });


  it('list', async function () {
    let data = await country.list({})
    expect(data.length).to.not.equal(0)
  });

  it('list + fields', async function () {

    let data = await country.list({fields: 'country'})
    expect(Object.keys(data[0]).length).to.equal(1)
    expect(Object.keys(data[0])[0]).to.equal('country')

    data = await country.list({f: 'country'})
    expect(Object.keys(data[0]).length).to.equal(1)
    expect(Object.keys(data[0])[0]).to.equal('country')

    data = await country.list({f: 'country_id,country'})
    expect(Object.keys(data[0]).length).to.equal(2)
    expect(Object.keys(data[0])[0]).to.equal('country_id')
    expect(Object.keys(data[0])[1]).to.equal('country')


  });

  it('list + limit', async function () {
    let data = await country.list({limit: 2})
    expect(data.length).to.equal(2)

    data = await country.list({l: 2})
    expect(data.length).to.equal(2)

  });

  it('list + offset', async function () {
    let data = await country.list({offset: 1})
    expect(data[0]['country']).to.not.equal('Afghanistan')

  });

  it('list + where', async function () {

    let data = await country.list({where: '(country,eq,India)'})
    expect(data.length).to.equal(1)

    data = await country.list({w: '(country,eq,India)'})
    expect(data.length).to.equal(1)

  });

  it('list + sort', async function () {

    let data = await country.list({sort: 'country'})
    expect(data[0]['country']).to.equal('Afghanistan')

    data = await country.list({sort: '-country'})
    expect(data[0]['country']).to.equal('Zambia')

  });

  it('list + sort', async function () {

    let data = await country.list({sort: 'country'})
    expect(data[0]['country']).to.equal('Afghanistan')

    data = await country.list({sort: '-country'})
    expect(data[0]['country']).to.equal('Zambia')

  });

  it('findOne', async function () {

    let data = await country.findOne({where: '(country,eq,India)'})
    expect(data['country']).to.equal('India')

    data = await country.findOne({sort: '-country'})
    expect(data['country']).to.equal('Zambia')

    data = await country.findOne({offset: '1'})
    expect(data['country']).not.to.equal('Afghanistan')

    data = await country.findOne()
    expect(data['country']).to.equal('Afghanistan')

  });

  it('count', async function () {
    let data = await country.countByPk({});
    expect(data['count']).to.be.above(100)
  });


  it('groupBy', async function () {
    let data = await city.groupBy({cn: 'country_id', limit: 2});
    expect(data[0]['count']).to.not.equal(0);
    expect(data.length).to.be.equal(2);
    data = await city.groupBy({cn: 'country_id', having: '(count,gt,50)'});
    expect(data.length).to.be.equal(2);
  });

  it('aggregate', async function () {

    let data = await city.aggregate({cn: 'country_id', fields: 'country_id', func: 'count,sum,avg'});
    expect(data[0]['count']).to.not.equal(0);
    expect(data[0]['sum']).to.not.equal(0);
    expect(data[0]['avg']).to.not.equal(0);

    data = await city.aggregate({
     column_name:'country_id',
      fields: 'country_id',
      func: 'count,sum,avg',
      having: '(count,gt,50)'
    });
    expect(data.length).to.be.equal(2);

  });

  it('distinct', async function () {

    let data = await city.distinct({cn: 'country_id'});
    expect(Object.keys(data[0]).length).to.be.equal(1);
    expect(data[0]['country_id']).to.not.equal(0);

    data = await city.distinct({cn: 'country_id', fields: 'city'});
    expect(Object.keys(data[0]).length).to.be.equal(2);

  });

  it('distribution', async function () {

    let data = await city.distribution({cn: 'country_id', steps: '0,20,40,100'});
    expect(data.length).to.be.equal(3);
    expect(data[0]['range']).to.be.equal('0-20');
    expect(data[0]['count']).to.be.above(70);
    expect(data[1]['range']).to.be.equal('21-40');
    expect(data[1]['count']).to.be.equal(100);
    expect(data[2]['range']).to.be.equal('41-100');

    data = await city.distribution({cn: 'country_id', step: 20, min: 0, max: 100});
    expect(data.length).to.be.equal(5);
    expect(data[0]['range']).to.be.equal('0-20');
    expect(data[0]['count']).to.be.above(70);
    expect(data[3]['count']).to.be.equal(106);

  });

  it('hasManyList', async function () {

    let data = await country.hasManyList({childs: 'city'})
    for (let i = 0; i < data.length; ++i) {
      expect(data[i].city.length).to.not.equal(0)
      expect(Object.keys(data[i]).length).to.be.equal(4)
      expect(Object.keys(data[i].city[0]).length).to.be.equal(4)
    }

    data = await country.hasManyList({childs: 'city', fields: 'country', fields1: 'city'})
    for (let i = 0; i < data.length; ++i) {
      expect(data[i].city.length).to.not.equal(0)
      expect(Object.keys(data[i]).length).to.be.equal(3)
      expect(Object.keys(data[i].city[0]).length).to.be.equal(2)
    }

    data = await models.film.hasManyList({childs: 'inventory.film_category'})
    for (let i = 0; i < data.length; ++i) {
      expect(data[i].inventory.length).to.not.equal(0)
      expect(data[i].film_category.length).to.not.equal(0)
    }

  });

  it('belongsTo', async function () {

    let data = await city.belongsTo({parents: 'country'})
    for (let i = 0; i < data.length; ++i) {
      expect(data[i].country).to.not.equal(null)
    }

  });

  it('hasManyListGQL', async function () {
    let data = await country.hasManyListGQL({ids: [1, 2], child: 'city'})
    expect(data['1'].length).to.not.equal(0)
    expect(data['2'].length).to.not.equal(0)
  });

  it('bulk - create, update, delete', async function () {

    // let data = await country.insertb([{country:'IN'}, {country:'US'}])
    // console.log(data);

  });


  it('update and delete with where', async function () {

    let data = await country.insertb([{country: 'abc'}, {country: 'abc'}])

    let updateCount = await country.update({
      data: {country: 'abcd'},
      where: '(country,eq,abc)'
    });

    expect(updateCount).to.be.equal(2);

    let deleteCount = await country.del({
      where: '(country,eq,abcd)'
    });

    expect(deleteCount).to.be.equal(2);
  });


  it('xc condition test', async function () {

    let data = await country.list({condition: {country_id: {eq: '34'}}})

    expect(data.length).to.be.equal(1);
    expect(data[0].country_id).to.be.equal(34);

    data = await country.list({condition: {_or: [{country: {like: 'Ind%'}}, {country: {like: '%dia'}}]}})
    const pattern = /^ind|dia$/i;
    for (const {country} of data) {
      expect(pattern.test(country)).to.be.equal(true);
    }
  });


});
