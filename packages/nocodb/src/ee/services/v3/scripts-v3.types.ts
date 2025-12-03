export type ScriptV3ListResponseType = {
  list: Array<{
    id: string;
    title: string;
    description: string;
    base_id: string;
    workspace_id: string;
  }>;
};

export type ScriptV3GetResponseType = {
  id: string;
  title: string;
  description: string;
  base_id: string;
  workspace_id: string;
  script: string;
  config: any;
  meta: any;
  created_at: string;
  updated_at: string;
};

export type ScriptV3RequestType = {
  title: string;
  description: string;
  script: string;
  config: any;
  meta: any;
};
