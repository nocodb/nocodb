// https://glebbahmutov.com/blog/restart-server/

// const { express } = require("express");
// const { bodyParser } = require("body-parser");

import express from 'express';
import bodyParser from 'body-parser';

let request = [];
const debugLog = false;

async function makeServer() {
  const app = express();
  app.use(bodyParser.json());

  app.get('/hook/all', (_req, res) => {
    if (debugLog) console.log('/hook/all :: ', request);
    res.json(request);
  });
  app.get('/hook/last', (_req, res) => {
    if (request.length) {
      if (debugLog) console.log('/hook/last :: ', request[request.length - 1]);
      res.json(request[request.length - 1]);
    }
  });
  app.get('/hook/count', (_req, res) => {
    if (debugLog) console.log('/hook/count :: ', request.length);
    res.json(request.length);
  });
  app.get('/hook/clear', (_req, res) => {
    request = [];
    if (debugLog) console.log('/hook/clear :: ', request.length);
    res.status(200).end();
  });

  app.post('/hook', (req, res) => {
    request.push(req.body);
    if (debugLog) console.log('/hook :: ', req.body); // Call your action on the request here
    res.status(200).end(); // Responding is important
  });

  app.post('/stop', (_req, _res) => {
    process.exit();
  });

  const port = 9090;

  return new Promise(resolve => {
    const server = app.listen(port, function () {
      const port = server.address().port;
      if (debugLog) console.log('Example app listening at port %d', port);

      // close the server
      const close = () => {
        return new Promise(resolve => {
          if (debugLog) console.log('closing server');
          server.close(resolve);
        });
      };

      resolve({ server, port, close });
    });
  });
}

export default makeServer;
