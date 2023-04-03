const insert = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    uuid: { type: 'string', maxLength: 255 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    meta: { type: 'string' },
    row_height: { type: 'integer' }
  },
  required: ['fk_view_id', 'base_id', 'project_id', 'row_height'],
  additionalProperties: false
}

const update = {
  type: 'object',
  properties: {
    fk_view_id: { type: 'string', maxLength: 20 },
    base_id: { type: 'string', maxLength: 20 },
    project_id: { type: 'string', maxLength: 128 },
    uuid: { type: 'string', maxLength: 255 },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    meta: { type: 'string' },
    row_height: { type: 'integer' }
  },
  required: ['fk_view_id', 'base_id', 'project_id', 'row_height'],
  additionalProperties: false
}
