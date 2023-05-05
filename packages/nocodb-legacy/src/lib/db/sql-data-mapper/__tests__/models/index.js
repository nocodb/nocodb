const {DbFactory} = require('../../build/main/index');
const path = require('path');
const glob = require('glob');

let models = {};

const password = process.env.NODE_ENV === 'test' ? '' : 'password';

dbDriver = DbFactory.create({
  "client": "mysql",
  "connection": {
    "host": "localhost",
    "port": "3306",
    "user": "root",
    "password": password,
    "database": "sakila"
  }
});

let modelsPath = path.join(__dirname, '*.model.js');
dbDriver = dbDriver || {};

glob.sync(modelsPath).forEach((file) => {
  let model = require(file)
  models[model.name] = new model({dbDriver});
});

module.exports = models;
