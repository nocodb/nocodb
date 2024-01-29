import { expect } from 'chai';
import 'mocha';
import request from 'supertest';
import { OrgUserRoles } from 'nocodb-sdk';
import init from '../../../init';
import type { OpenIDClientConfigType } from 'nocodb-sdk';

// Test case list in this file
// 1. Get client list
// 2. Create a new client - SAML - with invalid and valid payloads
// 3. Create a new client - OpenID - with invalid and valid payloads
// 4. Update client - SAML - with invalid and valid payloads
// 5. Update client - OpenID - with invalid and valid payloads
// 6. Remove client - SAML/OpenID
// 7. Get login urls(utils api) and verify - SAML
// 8. Get login urls(utils api) and verify - OpenID

const validSAMLPayload = {
  type: 'saml',
  title: 'test',
  config: {
    xml: `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://saml.example.com/entityid" validUntil="2034-01-29T06:36:01.881Z">
<md:IDPSSODescriptor WantAuthnRequestsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
<md:KeyDescriptor use="signing">
<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
<ds:X509Data>
<ds:X509Certificate>MIIC4jCCAcoCCQC33wnybT5QZDANBgkqhkiG9w0BAQsFADAyMQswCQYDVQQGEwJV SzEPMA0GA1UECgwGQm94eUhRMRIwEAYDVQQDDAlNb2NrIFNBTUwwIBcNMjIwMjI4 MjE0NjM4WhgPMzAyMTA3MDEyMTQ2MzhaMDIxCzAJBgNVBAYTAlVLMQ8wDQYDVQQK DAZCb3h5SFExEjAQBgNVBAMMCU1vY2sgU0FNTDCCASIwDQYJKoZIhvcNAQEBBQAD ggEPADCCAQoCggEBALGfYettMsct1T6tVUwTudNJH5Pnb9GGnkXi9Zw/e6x45DD0 RuRONbFlJ2T4RjAE/uG+AjXxXQ8o2SZfb9+GgmCHuTJFNgHoZ1nFVXCmb/Hg8Hpd 4vOAGXndixaReOiq3EH5XvpMjMkJ3+8+9VYMzMZOjkgQtAqO36eAFFfNKX7dTj3V pwLkvz6/KFCq8OAwY+AUi4eZm5J57D31GzjHwfjH9WTeX0MyndmnNB1qV75qQR3b 2/W5sGHRv+9AarggJkF+ptUkXoLtVA51wcfYm6hILptpde5FQC8RWY1YrswBWAEZ NfyrR4JeSweElNHg4NVOs4TwGjOPwWGqzTfgTlECAwEAATANBgkqhkiG9w0BAQsF AAOCAQEAAYRlYflSXAWoZpFfwNiCQVE5d9zZ0DPzNdWhAybXcTyMf0z5mDf6FWBW 5Gyoi9u3EMEDnzLcJNkwJAAc39Apa4I2/tml+Jy29dk8bTyX6m93ngmCgdLh5Za4 khuU3AM3L63g7VexCuO7kwkjh/+LqdcIXsVGO6XDfu2QOs1Xpe9zIzLpwm/RNYeX UjbSj5ce/jekpAw7qyVVL4xOyh8AtUW1ek3wIw1MJvEgEPt0d16oshWJpoS1OT8L r/22SvYEo3EmSGdTVGgk3x3s+A0qWAqTcyjr7Q4s/GKYRFfomGwz0TZ4Iw1ZN99M m0eo2USlSRTVl7QHRTuiuSThHpLKQQ== </ds:X509Certificate>
</ds:X509Data>
</ds:KeyInfo>
</md:KeyDescriptor>
<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://mocksaml.com/api/saml/sso"/>
<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://mocksaml.com/api/saml/sso"/>
</md:IDPSSODescriptor>
</md:EntityDescriptor>`,
  },
};

const validOpenIDPayload = {
  type: 'oidc',
  title: 'test',
  config: {
    clientId: 'kbyuFDidLLm280LIwVFiazOqjO3ty8KH',
    authUrl: 'https://samples.auth0.com/authorize',
    tokenUrl: 'https://samples.auth0.com/oauth/token',
    userInfoUrl: 'https://samples.auth0.com/userinfo',
    logoutUrl: 'https://samples.auth0.com/v2/logout',
    callbackUrl: 'https://samples.auth0.com/callback',
    clientSecret: 'secret',
    issuer: 'https://samples.auth0.com/',
    scopes: ['profile', 'email'],
  } as OpenIDClientConfigType,
};

function ssoTests() {
  let context: Awaited<ReturnType<typeof init>>;

  beforeEach(async function () {
    console.time('#### ssoTests');
    context = await init();
    console.timeEnd('#### ssoTests');
  });

  it('Get client list', async () => {
    const response = await request(context.app)
      .get('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .expect(200);

    expect(response.body).to.have.keys(['list']);
    expect(response.body.list).to.have.length(0);
  });

  it('Create a new client - SAML - with invalid and valid payloads', async () => {
    //  with invalid payload
    await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send({ type: 'saml', title: 'sample', config: {} })
      .expect(400);

    // with valid payload
    const res = await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send(validSAMLPayload)
      .expect(200);

    expect(res.body).to.have.property('id');
  });
  it('Create a new client - OpenID - with invalid and valid payloads', async () => {
    //  with invalid payload
    await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send({ type: 'oidc', config: {} })
      .expect(400);

    // with valid payload
    const res = await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send(validOpenIDPayload)
      .expect(200);

    expect(res.body).to.have.property('id');
  });

  it('Update client - SAML - with invalid and valid payloads', async () => {
    // create saml client
    const res = await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send(validSAMLPayload)
      .expect(200);

    expect(res.body).to.have.property('id');

    const id = res.body.id;

    // update with invalid payload
    await request(context.app)
      .patch(`/api/v2/sso-client/${id}`)
      .set('xc-auth', context.token)
      .send({
        config: {
          xml: 'invalid xml',
        },
      })
      .expect(400);

    // update with valid payload ( disable )
    await request(context.app)
      .patch(`/api/v2/sso-client/${id}`)
      .set('xc-auth', context.token)
      .send({
        enabled: false,
      })
      .expect(200);

    // get the client list and verify
    const response = await request(context.app)
      .get('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .expect(200);

    expect(response.body).to.have.keys(['list']);
    expect(response.body.list).to.have.length(1);

    const client = response.body.list[0];

    expect(client).to.have.property('id').to.be.equal(id);
    expect(client).to.have.property('enabled').to.be.equal(false);
  });

  it('Update client - OpenID - with invalid and valid payloads', async () => {
    // create saml client
    const res = await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send(validOpenIDPayload)
      .expect(200);

    expect(res.body).to.have.property('id');

    const id = res.body.id;

    // update with invalid payload
    await request(context.app)
      .patch(`/api/v2/sso-client/${id}`)
      .set('xc-auth', context.token)
      .send({
        config: {
          xml: 'invalid prop',
        },
      })
      .expect(400);

    // update with valid payload ( disable )
    await request(context.app)
      .patch(`/api/v2/sso-client/${id}`)
      .set('xc-auth', context.token)
      .send({
        enabled: false,
      })
      .expect(200);

    // get the client list and verify
    const response = await request(context.app)
      .get('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .expect(200);

    expect(response.body).to.have.keys(['list']);
    expect(response.body.list).to.have.length(1);

    const client = response.body.list[0];

    expect(client).to.have.property('id').to.be.equal(id);
    expect(client).to.have.property('enabled').to.be.equal(false);
  });

  it('Remove client - OpenID/SAML', async () => {
    for (const payload of [validOpenIDPayload, validSAMLPayload]) {
      // create client
      const res = await request(context.app)
        .post('/api/v2/sso-client')
        .set('xc-auth', context.token)
        .send(payload)
        .expect(200);

      expect(res.body).to.have.property('id');

      const id = res.body.id;

      // get the client list and verify
      const listResponse = await request(context.app)
        .get('/api/v2/sso-client')
        .set('xc-auth', context.token)
        .expect(200);

      expect(listResponse.body).to.have.keys(['list']);
      expect(listResponse.body.list).to.have.length(1);

      const client = listResponse.body.list[0];

      expect(client).to.have.property('id').to.be.equal(id);
      expect(client).to.have.property('enabled').to.be.equal(true);

      // delete client
      await request(context.app)
        .delete(`/api/v2/sso-client/${id}`)
        .set('xc-auth', context.token)
        .expect(200);

      // get the client list and verify
      const listResponseAfterDelete = await request(context.app)
        .get('/api/v2/sso-client')
        .set('xc-auth', context.token)
        .expect(200);

      expect(listResponseAfterDelete.body).to.have.keys(['list']);
      expect(listResponseAfterDelete.body.list).to.have.length(0);
    }
  });

  it('Get login urls(utils api) and verify - SAML', async () => {
    // create saml client
    const res = await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send(validSAMLPayload)
      .expect(200);

    expect(res.body).to.have.property('id');

    const appInfoRes = await request(context.app)
      .get('/api/v2/meta/nocodb/info')
      .set('xc-auth', context.token)
      .expect(200);

    expect(appInfoRes.body)
      .to.have.property('ssoClients')
      .is.an('array')
      .length(1);

    const client = appInfoRes.body.ssoClients[0];

    expect(client).to.have.property('id').to.be.equal(res.body.id);
    expect(client).to.have.property('url').is.a('string');

    const loginUrl = new URL(client.url);

    await request(context.app)
      .get(loginUrl.pathname)
      .set('xc-auth', context.token)
      .expect('Location', /https:\/\/mocksaml.com\/api\/saml\/sso/);
  });

  it('Get login urls(utils api) and verify - OpenId', async () => {
    // create saml client
    const res = await request(context.app)
      .post('/api/v2/sso-client')
      .set('xc-auth', context.token)
      .send(validOpenIDPayload)
      .expect(200);

    expect(res.body).to.have.property('id');

    const appInfoRes = await request(context.app)
      .get('/api/v2/meta/nocodb/info')
      .set('xc-auth', context.token)
      .expect(200);

    expect(appInfoRes.body)
      .to.have.property('ssoClients')
      .is.an('array')
      .length(1);

    const client = appInfoRes.body.ssoClients[0];

    expect(client).to.have.property('id').to.be.equal(res.body.id);
    expect(client).to.have.property('url').is.a('string');

    const loginUrl = new URL(client.url);

    await request(context.app)
      .get(loginUrl.pathname)
      .set('xc-auth', context.token)
      .expect('Location', /https:\/\/samples.auth0.com\/authorize/);
  });
}

export default function () {
  if (process.env.EE) {
    describe('SSO', ssoTests);
  }
}
