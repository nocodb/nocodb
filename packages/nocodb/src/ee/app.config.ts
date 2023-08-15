import type { AppConfig } from '~/interface/config';

const config: AppConfig = {
  throttler: {
    ttl: 60,
    max_apis: 10000,
    calc_execution_time: true,
  },
  basicAuth: {
    username: process.env.NC_HTTP_BASIC_USER ?? 'defaultusername',
    password: process.env.NC_HTTP_BASIC_PASS ?? 'defaultpassword',
  },
  workspace: {
    sns: {
      apiVersion: '2010-03-31',
      topicArn: process.env.NC_WORKSPACE_SNS_TOPIC_ARN,
      region: process.env.NC_WORKSPACE_SNS_REGION,
      credentials: {
        accessKeyId:
          process.env.NC_WORKSPACE_SNS_ACCESS_KEY_ID ??
          process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey:
          process.env.NC_WORKSPACE_SNS_SECRET_ACCESS_KEY ??
          process.env.AWS_SECRET_ACCESS_KEY,
      },
    },
  },
  auth: {
    emailPattern:
      process.env.NC_EMAIL_PATTERN && new RegExp(process.env.NC_EMAIL_PATTERN),
    disableEmailAuth: !!process.env.NC_DISABLE_EMAIL_AUTH,
  },
  mainSubDomain: process.env.NC_MAIN_SUBDOMAIN ?? 'app',
};

export default config;
