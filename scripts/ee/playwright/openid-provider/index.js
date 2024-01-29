// ref: https://github.com/magnolia-cms/mock-oidc-user-server/blob/master/server.js

const assert = require('assert')
const camelCase = require('camelcase')

const Provider = require('oidc-provider')

process.env.CLIENT_ID='my-client'
process.env.CLIENT_SECRET='my-secret'
process.env.CLIENT_REDIRECT_URI='http://localhost:8080/.auth'
process.env.CLIENT_LOGOUT_REDIRECT_URI='http://localhost:8080/.magnolia/admincentral'



const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 4000

const config = ['CLIENT_ID', 'CLIENT_SECRET', 'CLIENT_REDIRECT_URI', 'CLIENT_LOGOUT_REDIRECT_URI'].reduce((acc, v) => {
  assert(process.env[v], `${v} config missing`)
  acc[camelCase(v)] = process.env[v]
  return acc
}, {})

const oidcConfig = {
  claims: {
    email: ['email'],
    profile: ['name', 'preferred_username']
  },
  clients: [{
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uris: [config.clientRedirectUri],
    post_logout_redirect_uris: [config.clientLogoutRedirectUri]
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