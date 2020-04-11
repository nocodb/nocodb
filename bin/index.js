#! /usr/bin/env node

require('dotenv').config();
const morgan = require("morgan");
const bodyParser = require("body-parser");
const express = require("express");
const sqlConfig = require("commander");
const mysql = require("mysql");
const cors = require("cors");
const dataHelp = require("../lib/util/data.helper.js");
const Xapi = require("../lib/xapi.js");
const cmdargs = require("../lib/util/cmd.helper.js");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;

const fs = require('fs');
const https = require('https');

function startXmysql(sqlConfig) {
  /**************** START : setup express ****************/
  let app = express();
  app.use(morgan("tiny"));
  app.use(cors());
  app.use(bodyParser.json());
  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  );
  /**************** END : setup express ****************/

  /**************** START : setup mysql ****************/
  let mysqlPool = mysql.createPool(sqlConfig);
  /**************** END : setup mysql ****************/

  /**************** START : setup Xapi ****************/
  console.log("");
  console.log("");
  console.log("");
  console.log("          Generating REST APIs at the speed of your thought.. ");
  console.log("");
  console.log("          > modified to support JWT and owner privileges");
  console.log("");

  let t = process.hrtime();
  let moreApis = new Xapi(sqlConfig, mysqlPool, app);

  moreApis.init((err, results) => {
    if (process.env.USE_HTTPS==='true'){
      console.log("launching https server on port=".bold.green, sqlConfig.portNumber)

      const privateKey  = fs.readFileSync(process.env.PRIVATE_KEY, 'utf8');
      const certificate = fs.readFileSync(process.env.SSL_CERTIFICATE, 'utf8');
      const credentials = {key: privateKey, cert: certificate};

      httpsServer = https.createServer(credentials, app);
      httpsServer.listen(sqlConfig.portNumber);
    }
    else {
      console.log("launching http server on port=".bold.red, sqlConfig.portNumber)
      app.listen(sqlConfig.portNumber, sqlConfig.ipAddress);
    }

    var t1 = process.hrtime(t);
    var t2 = t1[0] + t1[1] / 1000000000;

    console.log(
      "          Xmysql took           :    %d seconds",
      dataHelp.round(t2, 1)
    );
    console.log(
      "          API's base URL        :    " +
        sqlConfig.ipAddress + ":" + sqlConfig.portNumber
    );
    console.log("                                                            ");
    if (!!sqlConfig.DEV){
      console.log("");
      let dev_status_msg = `          (!) running in DEV mode, JWT authorization is disabled.`
      console.log(`${dev_status_msg}`.green.bold);
      console.log("");
    }    
    console.log(
      " - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - "
    );
  });
  /**************** END : setup Xapi ****************/
}

function start(sqlConfig) {
  //handle cmd line arguments
  cmdargs.handle(sqlConfig);

  if (cluster.isMaster && sqlConfig.useCpuCores > 1) {
    console.log(`Master ${process.pid} is running`);

    for (let i = 0; i < numCPUs && i < sqlConfig.useCpuCores; i++) {
      console.log(`Forking process number ${i}...`);
      cluster.fork();
    }

    cluster.on("exit", function(worker, code, signal) {
      console.log(
        "Worker " +
          worker.process.pid +
          " died with code: " +
          code +
          ", and signal: " +
          signal
      );
      console.log("Starting a new worker");
      cluster.fork();
    });
  } else {
    startXmysql(sqlConfig);
  }
}

start(sqlConfig);
