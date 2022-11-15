// https://glebbahmutov.com/blog/restart-server/

// const { express } = require("express");
// const { bodyParser } = require("body-parser");

import express from 'express';
import bodyParser from 'body-parser';

let request = [];

async function makeServer() {
  const app = express();
  app.use(bodyParser.json());

  app.get('/hook/all', (req, res) => {
    // console.log(request)
    res.json(request);
  });
  app.get('/hook/last', (req, res) => {
    if (request.length) {
      // console.log(request[request.length - 1])
      res.json(request[request.length - 1]);
    }
  });
  app.get('/hook/count', (req, res) => {
    // console.log(request.length)
    res.json(request.length);
  });
  app.get('/hook/clear', (req, res) => {
    request = [];
    res.status(200).end();
  });

  app.post('/hook', (req, res) => {
    request.push(req.body);
    // console.log("/hook :: ", req.body) // Call your action on the request here
    res.status(200).end(); // Responding is important
  });

  app.post('/stop', (req, res) => {
    process.exit();
  });

  const port = 9090;

  return new Promise(resolve => {
    const server = app.listen(port, function () {
      const port = server.address().port;
      // console.log("Example app listening at port %d", port);

      // close the server
      const close = () => {
        return new Promise(resolve => {
          // console.log("closing server");
          server.close(resolve);
        });
      };

      resolve({ server, port, close });
    });
  });
}

export default makeServer;
