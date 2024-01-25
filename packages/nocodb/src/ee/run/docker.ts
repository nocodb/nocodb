process.env[`NC_DASHBOARD_URL`] = '/';

import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders: 'xc-db-response',
  }),
);

process.env.NC_SSO_OIDC_ISSUER='https://cognito-idp.us-east-2.amazonaws.com/us-east-2_STrmC0yso'
process.env.NC_SSO_OIDC_AUTHORIZATION_URL='https://auth.nocohub.ai/oauth2/authorize'
process.env.NC_SSO_OIDC_TOKEN_URL='https://auth.nocohub.ai/oauth2/token'
process.env.NC_SSO_OIDC_USERINFO_URL='https://auth.nocohub.ai/oauth2/userInfo'
process.env.NC_SSO_OIDC_CLIENT_ID='15hld9efpnfftfe6mofns4koua'
process.env.NC_SSO_OIDC_CLIENT_SECRET='1d5ek2h51pjrhloungu5pv2mb4bjijnvij4hi1o1so9ig4t1eh2c'
process.env.NC_SSO_OIDC_PROVIDER_NAME='Cognito'


process.env.NC_SSO='openid'

process.env.NC_SAML_ISSUER='nocodb'
process.env.NC_SAML_ENTRY_POINT='http://localhost:9090/realms/master/protocol/saml'
process.env.NC_SAML_CERT='MIICmzCCAYMCBgGNOixhBzANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZtYXN0ZXIwHhcNMjQwMTI0MDYzMTQzWhcNMzQwMTI0MDYzMzIzWjARMQ8wDQYDVQQDDAZtYXN0ZXIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDF0pbX5+QrsCa/GQhkFZg2sHPkISwRSkUZBwUr8cYKD9S+Nx/yE4/IroqSml3V88Xwgx+y8EC5httuXN/zI/LpN1EJVvkX6l+njuxyqZI+fNsFOc9ZgdeA28JmNbUKtWOy4hnLDVN0bveyKOthsKHO/cOSi5fnlZfoY5BJSZvEctDzDqefFc9XbBMMIYIh1ww1W5qQpoc8bLjqT/SuvqAS4/FI0ymmJ/mGGu5y0KqjGlgV9QSgTPXRQatwpCQoOjy/sDwdLqknK3ZRxEMJrSS/cU+qPOxhiEhgbDiO5OLGzGzchLd4AFEkqrCzRiKsPvbWTfu6aF4p1reIxrZ77E1jAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABdnm/WPe4gFw21pDKR/dbkWu8vdO8CGdI9migOlswLIrLzX3MrheSlSBTzRRIExGREDB0QZyrVUPSAe8B931U1SuZMHSf07m0HO6tNIuj0WyXsfE1S/ko5xoSgDXMFI5Nh5iX3djA4LtXR+0YYRgcQ/xf60bQYlpplILUHztBM15MDvOwnX28n0fLzroolw5qAtxaCCfRIrJ0f1jPmc+zuhIw6t0IIW3OpJnxyCQ1hO6JYMYpkzlRwnZZWzBLVEtbx1ML9KnThVPLGKrZyT9AUebfuZAvd9JsFMzcuzLDMdkgR0GYahBPnlXnTOVyrWg+AGX934VYomi+DkqPkAqKc='

server.set('view engine', 'ejs');

process.env[`DEBUG`] = 'xc*';

server.use('/', express.static('/Users/pranavc/develop/nocohub/packages/nc-gui/ee/dist'));
// (async () => {
//   await nocobuild(server);
//   const httpServer = server.listen(process.env.PORT || 8080, async () => {
//     console.log('Server started');
//   });
// })().catch((e) => console.log(e));

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
