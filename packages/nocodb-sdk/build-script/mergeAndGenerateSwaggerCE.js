const {writeFileSync, readFileSync} = require('fs');
// import {mergeSwaggerSchema} from "../../src";

const swaggerV3 = JSON.parse(readFileSync('../nocodb/src/schema/swagger-v3.json', 'utf8'), (key, value) => {
  if (key === '$ref') {
    return value.replace(/^(#\/components\/schemas\/)(\w+)$/, '$1$2V3');
  }
  return value;
});
swaggerV3.components.schemas = Object.entries(swaggerV3.components.schemas).reduce((acc, [key, value]) => {
  return {
    [key + 'V3']: value,
    ...acc
  }
}, {})

const swaggerCE = JSON.parse(readFileSync('../nocodb/src/schema/swagger.json', 'utf8'));
const swagger = {
  ...swaggerCE,
  paths: {
    ...swaggerCE.paths,
  },
  components: {
    ...swaggerCE.components,
    schemas: {
      ...swaggerV3.components.schemas,
      ...swaggerCE.components.schemas,
    },
    responses: {
      ...swaggerCE.components.responses,
    },
  },
};

writeFileSync('nc_swagger.json', JSON.stringify(swagger));
