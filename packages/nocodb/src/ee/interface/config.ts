export interface AppConfig {
  cognito: {
    aws_project_region: string;
    aws_cognito_identity_pool_id: string;
    aws_cognito_region: string;
    aws_user_pools_id: string;
    aws_user_pools_web_client_id: string;

    oauth: {
      domain: string;
      redirectSignIn: string;
      redirectSignOut: string;
    };
  };

  throttler: {
    data: {
      ttl: number;
      max_apis: number;
      block_duration: number;
    };
    data_gui: {
      ttl: number;
      max_apis: number;
      block_duration: number;
    };
    meta: {
      ttl: number;
      max_apis: number;
      block_duration: number;
    };
    meta_gui: {
      ttl: number;
      max_apis: number;
      block_duration: number;
    };
    public: {
      ttl: number;
      max_apis: number;
      block_duration: number;
    };
    calc_execution_time: boolean;
  };
  basicAuth: {
    username: string;
    password: string;
  };

  sns: {
    apiVersion: string;
    region?: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  };

  workspace: {
    sns: {
      topicArn: string;
    };
  };

  dbMux: {
    sns: {
      topicArn: string;
    };
  };

  systemEvents: {
    sns: {
      topicArn: string;
    };
  };

  auth: {
    emailPattern?: RegExp | null;
    disableEmailAuth: boolean;
  };
  mainSubDomain: string;
  dashboardPath: string;
}

export * from 'src/interface/config';
