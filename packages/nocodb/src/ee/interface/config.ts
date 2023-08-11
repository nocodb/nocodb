export interface AppConfig {
  throttler: {
    ttl: number;
    max_apis: number;
    calc_execution_time: boolean;
  };
  basicAuth: {
    username: string;
    password: string;
  };

  workspace: {
    sns: {
      topicArn: string;
      region?: string;
      apiVersion?: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
      };
    };
  };

  auth: {
    emailPattern?: RegExp | null;
    disableEmailAuth: boolean;
  };
  mainSubDomain: string;
}

export * from 'src/interface/config';
