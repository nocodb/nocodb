// ref: https://github.com/mcguinness/saml-idp

const { runServer } = require('saml-idp')

runServer({
  acsUrl: process.env.REDIRECT_URL,
  audience: process.env.AUDIENCE,
  issuer: process.env.AUDIENCE,
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
