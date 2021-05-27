const {
  BaseModelSql} = require('../../build/main/index');


class country extends BaseModelSql {

  constructor({
    dbDriver
  }) {

    super({
      dbDriver,
      ...require('./country.meta.js')
    });

  }

}


module.exports = country;
