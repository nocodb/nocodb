const insert = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string", maxLength: 255 },
    type: { type: "string", maxLength: 255 },
    details: { type: "string" },
    deleted: { type: "boolean" },
    enabled: { type: "boolean" },
    order: { type: "number" },
    project_id: { type: "string", maxLength: 128 },
    fk_user_id: { type: "string", maxLength: 20 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    base_id: { type: "string", maxLength: 20 }
  },
  required: ["id", "project_id", "created_at", "updated_at"],
  additionalProperties: false
};

const update = {
  type: "object",
  properties: {
    title: { type: "string", maxLength: 255 },
    type: { type: "string", maxLength: 255 },
    details: { type: "string" },
    deleted: { type: "boolean" },
    enabled: { type: "boolean" },
    order: { type: "number" },
    project_id: { type: "string", maxLength: 128 },
    fk_user_id: { type: "string", maxLength: 20 },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    base_id: { type: "string", maxLength: 20 }
  },
  additionalProperties: false
};
