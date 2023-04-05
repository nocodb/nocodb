const {
  BaseModelSql} = require('../../build/main/index');


class film extends BaseModelSql {

  constructor({
    dbDriver
  }) {

    super({
      dbDriver,
      ...require('./film.meta.js')
    });

  }

}


module.exports = film;
