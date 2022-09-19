
// https://glebbahmutov.com/blog/restart-server/

const express = require('express')
const bodyParser = require("body-parser")

let request = []

function makeServer() {
  const app = express()
  app.use(bodyParser.json())

  app.get("/hook/all", (req, res) => {
    // console.log(request)
    res.json(request)
  })
  app.get("/hook/last", (req, res) => {
    if(request.length) {
      // console.log(request[request.length - 1])
      res.json(request[request.length - 1])
    }
  })
  app.get("/hook/count", (req, res) => {
    // console.log(request.length)
    res.json(request.length)
  })
  app.get("/hook/clear", (req, res) => {
    request = []
    res.status(200).end()
  })

  app.post("/hook", (req, res) => {
    request.push(req.body)
    // console.log("/hook :: ", req.body) // Call your action on the request here
    res.status(200).end() // Responding is important
  })

  app.post("/stop", (req, res) => {
    process.exit();
  })

  const port = 9090

  return new Promise((resolve) => {
    const server = app.listen(port, function () {
      const port = server.address().port
      console.log('Example app listening at port %d', port)

      // close the server
      const close = () => {
        return new Promise((resolve) => {
          console.log('closing server')
          server.close(resolve)
        })
      }

      resolve({ server, port, close })
    })
  })
}

module.exports = makeServer

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Raju Udava <sivadstala@gmail.com>
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
