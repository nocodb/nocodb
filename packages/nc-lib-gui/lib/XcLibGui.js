const express = require('express');
const bodyParser = require("body-parser");
const path = require('path');
const Emittery = require('emittery');

const EVENT_NAME = 'dbOps';

class XcLibGui {

  constructor(config) {
    this.config = config;
    this.emitter = new Emittery();
    process.env.TS_ENABLED = config.language === 'ts';
    this.io = require('socket.io')();
    this.io.listen(8081);
  }

  expressMiddleware() {

    const router = express.Router();

    router.use(bodyParser.json({
      limit: process.env.NC_REQUEST_BODY_SIZE || 1024 * 1024
    }));


    router.use('/', express.static(path.join(__dirname, 'dist')));


    // const os = require('os');
    //
    // try {
    //   const pty = require('node-pty-prebuilt-multiarch');
    //
    //   this.io.on('connection', client => {
    //
    //     const ptyProc = pty.spawn(os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/sh', [], {
    //       // cols: term.cols,
    //       rows: 70,//term.rows,
    //       cwd: process.cwd() || process.env.HOME,
    //       env: process.env
    //     });
    //
    //     client.on('req', data => {
    //       ptyProc.write(data);
    //     });
    //
    //     ptyProc.onData(data => {
    //       client.emit('res', data);
    //     });
    //
    //     client.on('disconnect', () => {
    //       console.log('Disconnected');
    //       ptyProc.kill();
    //     });
    //
    //   });
    // } catch (e) {
    //
    // }


    return router;
  }

  addListener(handler) {
    this.emitter.on(EVENT_NAME, handler);
  }

  destroy() {

    try {
      if (this.emitter) {
        this.emitter.clearListeners(EVENT_NAME);
      }

      if (this.io) {
        this.io.close(() => {
          console.log('Server connection closed');
        });
        this.io = null;
      }
    } catch (e) {
      console.log('xc-lib-gui : destroy error', e)
    }
  }

  reInitialize(config) {
    this.config = config;
    this.io = require('socket.io')();
    this.io.listen(8081);
  }


}

module.exports = XcLibGui;

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
