
export function mergeSwaggerSchema(swaggerCE, swaggerEE) {
  return {
    ...swaggerCE,
    ...swaggerEE,
    paths: {
      ...swaggerCE.paths,
      ...swaggerEE.paths,
    },
    components: {
      ...swaggerCE.components,
      ...swaggerEE.components,
      schemas: {
        ...swaggerCE.components.schemas,
        ...swaggerEE.components.schemas,
      },
      responses: {
        ...swaggerCE.components.responses,
        ...swaggerEE.components.responses,
      },
    },
  };
}
