/**
 * Centralized configuration for Bamboo HR Auth Integration
 */

// Environment variables
export const clientId = process.env.INTEGRATION_AUTH_BAMBOOHR_CLIENT_ID;
export const clientSecret = process.env.INTEGRATION_AUTH_BAMBOOHR_CLIENT_SECRET;
export const redirectUri = process.env.INTEGRATION_AUTH_BAMBOOHR_REDIRECT_URI;
const bambooHRScopes = {
  readPermissions: [
    // 'access_level',
    // 'benchmarking:compensation',
    // 'benefit',
    'company:info',
    // 'data_cleaner',
    // 'payroll',
    'employee:assets',
    'employee:emergency_contacts',
    'employee:vaccination',
    'employee:custom_fields',
    'employee:custom_fields_encrypted',
    'employee:demographic',
    'employee:dependent',
    'employee:dependent:ssn',
    'employee:education',
    'employee:contact',
    'employee:identification',
    'employee:job',
    'employee:management',
    'employee:photo',
    'employee',
    'employee:name',
    'employee_directory',
    'employee:file',
    'employee:compensation',
    // 'employee:providers',
    // 'employee:providers:payroll',
    'sensitive_employee:protected_info',
    'sensitive_employee:address',
    // 'sensitive_employee:creditcards',
    'field',
    // 'goal',
    // 'job_opening',
    // 'application',
    'offline_access', // for refresh_token
    'openid',
    // 'report',
    // 'tasks',
    // 'time_off',
    // 'time_tracking',
    // 'time_tracking:breaks',
    // 'training',
    // 'user',
    // 'user:management',
    // 'webhooks',
    // 'error_management',
    // 'public.integration',
    // 'public.user',
    // 'gridlets',
  ],
  writePermissions: [
    'benefit.write',
    'company_file.write',
    'company:administration.write',
    'payroll.write',
    'employee:assets.write',
    'employee:emergency_contacts.write',
    'employee:vaccination.write',
    'employee:custom_fields.write',
    'employee:custom_fields_encrypted.write',
    'employee:demographic.write',
    'employee:dependent.write',
    'employee:dependent:ssn.write',
    'employee:education.write',
    'employee:contact.write',
    'employee:identification.write',
    'employee:job.write',
    'employee:management.write',
    'employee:photo.write',
    'employee.write',
    'employee:name.write',
    'employee:file.write',
    'employee:compensation.write',
    'employee:providers.write',
    'employee:providers:payroll.write',
    'sensitive_employee:protected_info.write',
    'sensitive_employee:address.write',
    'sensitive_employee:creditcards.write',
    'employee:payroll.write',
    'field.write',
    'goal.write',
    'job_opening.write',
    'application.write',
    'tasks.write',
    'time_off.write',
    'time_tracking.write',
    'time_tracking:breaks.write',
    'training.write',
    'user:management.write',
    'webhooks.write',
  ],
};
export const scopes = bambooHRScopes.readPermissions;

// OAuth URIs for bamboo HR
// {{config.subdomain}} will be replaced at runtime
export const authUri =
  clientId && redirectUri
    ? `https://{{config.companyDomain}}.bamboohr.com/authorize.php?request=authorize&state=new&response_type=code&scope=${bambooHRScopes.readPermissions.join('+')}&client_id=${clientId}&redirect_uri=${redirectUri}`
    : '';

export const tokenUri =
  'https://{{config.companyDomain}}.bamboohr.com/token.php?request=token';
