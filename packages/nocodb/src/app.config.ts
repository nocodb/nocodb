import type { AppConfig } from './interface/config';

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
      topicArn:
        'arn:aws:sns:us-east-2:249717198246:nocohub-upgrade-workspace-staging',
      region: 'us-east-2',
    },
  },
};

export default config;
