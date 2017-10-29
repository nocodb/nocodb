#! /usr/bin/env node

const morgan = require('morgan');
const bodyParser = require('body-parser');
const express = require('express');
const sqlConfig = require('commander');
const mysql = require('mysql');

const Xapi = require('../lib/xapi.js');
const cmdargs = require('../lib/util/cmd.helper.js');

cmdargs.handle(sqlConfig)



/**************** START : setup express ****************/
let app = express();
app.use(morgan('tiny'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))
/**************** END : setup express ****************/


/**************** START : setup mysql ****************/
let mysqlPool = mysql.createPool(sqlConfig);
/**************** END : setup mysql ****************/


/**************** START : setup Xapi ****************/
let moreApis = new Xapi(sqlConfig,mysqlPool,app);

moreApis.init((err, results) => {

  app.listen(sqlConfig.portNumber)

})
/**************** END : setup Xapi ****************/
