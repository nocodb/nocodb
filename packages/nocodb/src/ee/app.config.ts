import type { AppConfig } from '~/interface/config';

const config: AppConfig = {
  cognito: {
    aws_project_region: process.env.NC_COGNITO_AWS_PROJECT_REGION,
    aws_cognito_identity_pool_id:
      process.env.NC_COGNITO_AWS_COGNITO_IDENTITY_POOL_ID,
    aws_cognito_region: process.env.NC_COGNITO_AWS_COGNITO_REGION,
    aws_user_pools_id: process.env.NC_COGNITO_AWS_USER_POOLS_ID,
    aws_user_pools_web_client_id:
      process.env.NC_COGNITO_AWS_USER_POOLS_WEB_CLIENT_ID,
    oauth: {
      domain: process.env.NC_COGNITO_OAUTH_DOMAIN,
      redirectSignIn: process.env.NC_COGNITO_OAUTH_REDIRECTSIGNIN,
      redirectSignOut: process.env.NC_COGNITO_OAUTH_REDIRECTSIGNOUT,
    },
  },

  throttler: {
    data: {
      ttl: +process.env.NC_DATA_API_TTL || 1,
      max_apis: +process.env.NC_DATA_COUNT || 10,
    },
    meta: {
      ttl: +process.env.NC_META_API_TTL || 1,
      max_apis: +process.env.NC_META_COUNT || 2,
    },
    public: {
      ttl: +process.env.NC_PUBLIC_API_TTL || 1,
      max_apis: +process.env.NC_PUBLIC_COUNT || 10,
    },
    calc_execution_time: false,
  },
  basicAuth: {
    username: process.env.NC_HTTP_BASIC_USER ?? 'defaultusername',
    password: process.env.NC_HTTP_BASIC_PASS ?? 'defaultpassword',
  },
  sns: {
    apiVersion: '2010-03-31',
    region: process.env.NC_SNS_REGION,
    credentials: {
      accessKeyId:
        process.env.NC_SNS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey:
        process.env.NC_SNS_SECRET_ACCESS_KEY ??
        process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  workspace: {
    sns: {
      topicArn: process.env.NC_WORKSPACE_SNS_TOPIC_ARN,
    },
  },
  dbMux: {
    sns: {
      topicArn: process.env.NC_SQL_EX_SNS_TOPIC_ARN,
    },
  },
  systemEvents: {
    sns: {
      topicArn: process.env.NC_SYSTEM_EVENTS_SNS_TOPIC_ARN,
    },
  },
  auth: {
    emailPattern:
      process.env.NC_EMAIL_PATTERN && new RegExp(process.env.NC_EMAIL_PATTERN),
    disableEmailAuth: !!process.env.NC_DISABLE_EMAIL_AUTH,
  },
  mainSubDomain: process.env.NC_MAIN_SUBDOMAIN ?? 'app',
  dashboardPath: process.env.NC_DASHBOARD_URL ?? '/dashboard',
};

export default config;
