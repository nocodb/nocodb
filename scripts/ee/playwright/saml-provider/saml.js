// ref: https://github.com/mcguinness/saml-idp
require('dotenv').config()
const {runServer} = require('@smartlook/saml-idp')

runServer({
  port: process.env.PORT || 7000,
  acsUrl: process.env.REDIRECT_URL ?? 'http://localhost:8080/sso/sson1bdd5iorz1rav/redirect',
  audience: process.env.AUDIENCE?? 'http://localhost:8080/sso/sson1bdd5iorz1rav' ,
  issuer: process.env.AUDIENCE?? 'http://localhost:8080/sso/sson1bdd5iorz1rav',
  config: {
    user: {
      email: 'test@nocodb.com',
    },
    // The auth-service requires at least one AttributeStatement in the SAML assertion.
    metadata: [{
      id: 'email',
      optional: false,
      displayName: 'E-Mail Address',
      description: 'The e-mail address of the user',
      multiValue: false,
    }],
  },
})
