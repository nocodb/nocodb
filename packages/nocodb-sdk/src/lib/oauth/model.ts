export interface OAuthClient {
  client_id: string;
  client_secret: string;

  client_name: string;
  description?: string;

  redirect_uri: string[]; // json string redirect uris
  allowed_scopes: string[]; // json string allowed scopes

  fk_user_id: string; // user who created the client

  created_at: string;
  updated_at: string;
}
