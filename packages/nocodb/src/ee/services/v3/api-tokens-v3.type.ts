export interface ApiTokensV3CreateRequest {
  title: string;
}

export interface ApiTokensV3 {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ApiTokensV3ListResponse {
  list: ApiTokensV3[];
}

export interface ApiTokensV3WithToken extends ApiTokensV3 {
  token: string;
}
