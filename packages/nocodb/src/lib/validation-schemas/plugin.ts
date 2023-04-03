// Insert schema
const insert= {
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 20 },
    title: { type: 'string', maxLength: 45 },
    description: { type: 'string' },
    active: { type: 'boolean' },
    rating: { type: 'number' },
    version: { type: 'string', maxLength: 255 },
    docs: { type: 'string', maxLength: 255 },
    status: { type: 'string', maxLength: 255 },
    status_details: { type: 'string', maxLength: 255 },
    logo: { type: 'string', maxLength: 255 },
    icon: { type: 'string', maxLength: 255 },
    tags: { type: 'string', maxLength: 255 },
    category: { type: 'string', maxLength: 255 },
    input_schema: { type: 'string' },
    input: { type: 'string' },
    creator: { type: 'string', maxLength: 255 },
    creator_website: { type: 'string', maxLength: 255 },
    price: { type: 'string', maxLength: 255 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'title', 'created_at', 'updated_at']
};

// Update schema
const update= {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 45 },
    description: { type: 'string' },
    active: { type: 'boolean' },
    rating: { type: 'number' },
    version: { type: 'string', maxLength: 255 },
    docs: { type: 'string', maxLength: 255 },
    status: { type: 'string', maxLength: 255 },
    status_details: { type: 'string', maxLength: 255 },
    logo: { type: 'string', maxLength: 255 },
    icon: { type: 'string', maxLength: 255 },
    tags: { type: 'string', maxLength: 255 },
    category: { type: 'string', maxLength: 255 },
    input_schema: { type: 'string' },
    input: { type: 'string' },
    creator: { type: 'string', maxLength: 255 },
    creator_website: { type: 'string', maxLength: 255 },
    price: { type: 'string', maxLength: 255 },
    updated_at: { type: 'string', format: 'date-time' },
  },
  minProperties: 1 // require at least one property to update
};
