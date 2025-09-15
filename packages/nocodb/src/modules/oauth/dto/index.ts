import z from 'zod';
import { OAuthClientType, OAuthTokenEndpointAuthMethod } from 'nocodb-sdk';

export const CreateOAuthClientSchema = z
  .object({
    client_name: z
      .string()
      .min(1, 'Client name is required')
      .max(255, 'Client name must be less than 255 characters')
      .trim(),

    client_type: z.nativeEnum(OAuthClientType, {
      errorMap: () => ({
        message: 'Client type must be either "confidential" or "public"',
      }),
    }),
    fk_user_id: z.string().optional(),

    client_uri: z
      .string()
      .url('Invalid client URI format')
      .optional()
      .or(z.literal('')),

    logo_uri: z
      .string()
      .url('Invalid logo URI format')
      .optional()
      .or(z.literal('')),

    redirect_uris: z
      .array(z.string().url('Each redirect URI must be a valid URL'))
      .min(1, 'At least one redirect URI is required'),

    allowed_grant_types: z
      .array(
        z.enum(
          [
            'authorization_code',
            'refresh_token',
            'client_credentials',
            'password',
          ],
          {
            errorMap: () => ({ message: 'Invalid grant type' }),
          },
        ),
      )
      .optional(),

    response_types: z
      .array(
        z.enum(['code', 'token', 'id_token'], {
          errorMap: () => ({ message: 'Invalid response type' }),
        }),
      )
      .optional(),

    allowed_scopes: z.string().max(1000, 'Scopes string too long').optional(),

    token_endpoint_auth_method: z
      .nativeEnum(OAuthTokenEndpointAuthMethod, {
        errorMap: () => ({
          message: 'Invalid token endpoint authentication method',
        }),
      })
      .optional(),

    description: z
      .string()
      .max(500, 'Description must be less than 500 characters')
      .optional(),
  })
  .refine(
    (data) => {
      // Custom validation: Public clients must use 'none' auth method
      return !(
        data.client_type === OAuthClientType.PUBLIC &&
        data.token_endpoint_auth_method &&
        data.token_endpoint_auth_method !== OAuthTokenEndpointAuthMethod.NONE
      );
    },
    {
      message: 'Public clients must use "none" authentication method',
      path: ['token_endpoint_auth_method'],
    },
  )
  .refine(
    (data) => {
      // Custom validation: Confidential clients cannot use 'none' auth method
      return !(
        data.client_type === OAuthClientType.CONFIDENTIAL &&
        data.token_endpoint_auth_method === OAuthTokenEndpointAuthMethod.NONE
      );
    },
    {
      message: 'Confidential clients cannot use "none" authentication method',
      path: ['token_endpoint_auth_method'],
    },
  );

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

  logo_uri: z
    .string()
    .url('Invalid logo URI format')
    .optional()
    .or(z.literal('')),

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

  token_endpoint_auth_method: z
    .nativeEnum(OAuthTokenEndpointAuthMethod)
    .optional(),

  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
});

export type CreateOAuthClientDto = z.infer<typeof CreateOAuthClientSchema>;
export type UpdateOAuthClientDto = z.infer<typeof UpdateOAuthClientSchema>;
