export const planSchema = {
  type: 'object',
  properties: {
    stripe_product_id: { type: 'string' },
    is_active: { type: 'boolean' },
  },
  required: ['stripe_product_id'],
} as const;
