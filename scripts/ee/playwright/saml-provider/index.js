// ref: https://github.com/mcguinness/saml-idp

const { runServer } = require('saml-idp')

runServer({
  acsUrl: `https://foo.okta.com/auth/saml20/assertion-consumer`,
  audience: `https://foo.okta.com/auth/saml20/metadata`,
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
    }, {
      id: 'userType',
      optional: true,
      displayName: 'User Type',
      description: 'The type of user',
      options: ['Admin', 'Editor', 'Commenter'],
    }],
  },
})
