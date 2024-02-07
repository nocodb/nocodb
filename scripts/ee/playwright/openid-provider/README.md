## Mocked OpenID Provider

A mock user server providing OpenID Connect (OIDC) flows for development and testing.

### Usage

- Set up following environment variables in `.env` file:
  - `CLIENT_ID` - the client ID, e.g. `test-client`
  - `CLIENT_SECRET` - the client secret, e.g. `test-secret`
  - `CLIENT_REDIRECT_URI` - the redirect URI copied from sso-client in nocodb, e.g. `http://localhost:8080/sso/ssoId/redirect`
  - `CLIENT_LOGOUT_REDIRECT_URI` - the redirect URI copied from sso-client in nocodb, e.g. `http://localhost:8080/sso/ssoId/redirect`
  - `PORT` - the port to listen on, e.g. `4000`
- Install dependencies with `npm install`
- Run the server with `npm start`