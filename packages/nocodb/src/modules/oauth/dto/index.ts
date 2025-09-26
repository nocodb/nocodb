import z from 'zod';
import { OAuthClientType } from 'nocodb-sdk';

export const CreateOAuthClientSchema = z.object({
  client_name: z
    .string()
    .min(1, 'Client name is required')
    .max(255, 'Client name must be less than 255 characters')
    .trim(),

  client_type: z
    .nativeEnum(OAuthClientType, {
      errorMap: () => ({
        message: 'Client type must be either "confidential" or "public"',
      }),
    })
    .default(OAuthClientType.PUBLIC)
    .optional(),

  fk_user_id: z.string().optional(),

  client_uri: z
    .string()
    .url('Invalid client URI format')
    .optional()
    .or(z.literal('')),

  client_description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),

  logo_uri: z.record(z.string(), z.unknown()).optional(),

  redirect_uris: z
    .array(z.string().url('Each redirect URI must be a valid URL'))
    .min(1, 'At least one redirect URI is required'),

  allowed_grant_types: z
    .array(
      z.enum(['authorization_code', 'refresh_token'], {
        errorMap: () => ({ message: 'Invalid grant type' }),
      }),
    )
    .default(['authorization_code', 'refresh_token'])
    .optional(),

  response_types: z
    .array(
      z.enum(['code', 'token', 'id_token'], {
        errorMap: () => ({ message: 'Invalid response type' }),
      }),
    )
    .optional(),

  allowed_scopes: z.string().max(1000, 'Scopes string too long').optional(),

  // Removed token_endpoint_auth_method - simplified to POST only per Airtable spec

  registration_client_uri: z
    .string()
    .url('Invalid registration client URI format')
    .optional(),

  registration_access_token: z.string().optional(),

  client_id_issued_at: z.number().optional(),

  client_secret_expires_at: z.number().optional(),
});

export const UpdateOAuthClientSchema = z.object({
  client_name: z
    .string()
    .min(1, 'Client name is required')
    .max(255, 'Client name must be less than 255 characters')
    .trim()
    .optional(),

  client_uri: z
    .string()
    .url('Invalid client URI format')
    .optional()
    .or(z.literal('')),

  client_description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),

  logo_uri: z.record(z.string(), z.unknown()).optional(), // Changed to match model (AttachmentResType)

  redirect_uris: z
    .array(z.string().url('Each redirect URI must be a valid URL'))
    .min(1, 'At least one redirect URI is required')
    .optional(),

  allowed_grant_types: z
    .array(
      z.enum([
        'authorization_code',
        'refresh_token',
        'client_credentials',
        'password',
      ]),
    )
    .optional(),

  response_types: z.array(z.enum(['code', 'token', 'id_token'])).optional(),

  allowed_scopes: z.string().max(1000, 'Scopes string too long').optional(),

  registration_client_uri: z
    .string()
    .url('Invalid registration client URI format')
    .optional(),

  client_secret_expires_at: z.number().optional(),
});

export type CreateOAuthClientDto = z.infer<typeof CreateOAuthClientSchema>;
export type UpdateOAuthClientDto = z.infer<typeof UpdateOAuthClientSchema>;
