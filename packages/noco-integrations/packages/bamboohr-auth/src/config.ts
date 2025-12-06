/**
 * Centralized configuration for Bamboo HR Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_BAMBOOHR_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_BAMBOOHR_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_BAMBOOHR_REDIRECT_URI;
export const scopes = [
  'employee:job',
  'employee:management',
  'employee:photo',
  'employee',
  'employee:name',
  'employee_directory',
  'employee:compensation',
  'sensitive_employee:protected_info',
  'sensitive_employee:address',
  'field',
  'offline_access', // for refresh_token
  'openid',
];

// OAuth URIs for bamboo HR
// {{config.subdomain}} will be replaced at runtime
export const authUri =
  clientId && redirectUri
    ? `https://{{config.companyDomain}}.bamboohr.com/authorize.php?request=authorize&state=new&response_type=code&scope=${scopes.join('+')}&client_id=${clientId}&redirect_uri=${redirectUri}`
    : '';

export const tokenUri =
  'https://{{config.companyDomain}}.bamboohr.com/token.php?request=token';
