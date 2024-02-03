// ref: https://github.com/magnolia-cms/mock-oidc-user-server/blob/master/server.js
// require('dotenv').config();
const assert = require('assert')

const Provider = require('oidc-provider')
const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 4000

const config = ['CLIENT_ID', 'CLIENT_SECRET', 'CLIENT_REDIRECT_URI', 'CLIENT_LOGOUT_REDIRECT_URI'].reduce((acc, v) => {
  assert(process.env[v], `${v} config missing`)
  acc[v] = process.env[v]
  return acc
}, {})

const oidcConfig = {
  claims: {
    email: ['email'],
    profile: ['name', 'preferred_username']
  },
  clients: [{
    client_id: config.CLIENT_ID,
    client_secret: config.CLIENT_SECRET,
    redirect_uris: [config.CLIENT_REDIRECT_URI],
    post_logout_redirect_uris: [config.CLIENT_LOGOUT_REDIRECT_URI]
  }],
  async findAccount (ctx, id) {
    return {
      accountId: id,
      async claims (use, scope) {
        return {
          sub: id,
          email: 'test@test.ch',
          name: 'test',
          preferred_username: 'Test'
        }
      }
    }
  }

}

const oidc = new Provider(`http://${host}:${port}`, oidcConfig)

oidc.callback()

oidc.listen(port, () => {
  console.log(`oidc-provider listening on port ${port}, check http://localhost:${port}/.well-known/openid-configuration`)
})