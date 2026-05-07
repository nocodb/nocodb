import z from 'zod';

export const DcrRequestSchema = z.object({
  client_name: z.string().min(1).max(255).trim(),
  redirect_uris: z.array(z.string().url()).min(1),
  grant_types: z
    .array(z.enum(['authorization_code', 'refresh_token']))
    .default(['authorization_code', 'refresh_token'])
    .optional(),
  response_types: z.array(z.enum(['code'])).default(['code']).optional(),
  token_endpoint_auth_method: z
    .enum(['client_secret_post', 'none'])
    .default('none')
    .optional(),
  scope: z.string().max(1000).optional(),
  client_uri: z.string().url().optional(),
  logo_uri: z.string().url().optional(),
});

export type DcrRequestDto = z.infer<typeof DcrRequestSchema>;
