## Mocked SAML Provider

A mock user server providing SAML flows for development and testing.  

### Usage

- Set up following environment variables in `.env` file:
  - `REDIRECT_URL` - the redirect URI copied from sso-client in nocodb, e.g. `http://localhost:8080/sso/ssoId/redirect`
  - `AUDIENCE` - entity ID/Audience of the service provider from sso-client in nocodb , e.g. `http://localhost:8080/sso/ssoId`
  - `PORT` - the port to listen on, e.g. `4000`
- Install dependencies with `npm install`
- Run the server with `npm start`