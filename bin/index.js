#! /usr/bin/env node

const morgan = require('morgan');
const bodyParser = require('body-parser');
const express = require('express');
const sqlConfig = require('commander');
const mysql = require('mysql');
const dataHelp = require('../lib/util/data.helper.js');
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
console.log('');
console.log('          REST APIs at the speed of thought.. ');
console.log('');

let t = process.hrtime();
let moreApis = new Xapi(sqlConfig,mysqlPool,app);

moreApis.init((err, results) => {

  app.listen(sqlConfig.portNumber)
  var t1 = process.hrtime(t);
  var t2 = t1[0]+t1[1]/1000000000

  console.log('                                                            ');
  console.log("          Xmysql took           :    %d seconds",dataHelp.round(t2,1));
  console.log('                                                            ');
  console.log(' - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ');



})
/**************** END : setup Xapi ****************/
