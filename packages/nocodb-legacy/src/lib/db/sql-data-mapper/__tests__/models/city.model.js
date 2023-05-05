const {
  BaseModelSql
} = require('../../build/main/index');

class city extends BaseModelSql {

  constructor({
    dbDriver
  }) {

    super({
      dbDriver,
      ...require('./city.meta.js')
    });

  }

}


module.exports = city;
