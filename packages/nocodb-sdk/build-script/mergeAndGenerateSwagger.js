const {writeFileSync, readFileSync} = require('fs');
// import {mergeSwaggerSchema} from "../../src";

const swaggerEE = JSON.parse(readFileSync('../nocodb/src/ee/schema/swagger.json', 'utf8'));
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
  ...swaggerEE,
  paths: {
    // ...swaggerV3.paths,
    ...swaggerCE.paths,
    ...swaggerEE.paths,
  },
  components: {
    ...swaggerCE.components,
    ...swaggerEE.components,
    schemas: {
      ...swaggerV3.components.schemas,
      ...swaggerCE.components.schemas,
      ...swaggerEE.components.schemas,
    },
    responses: {
      ...swaggerCE.components.responses,
      ...swaggerEE.components.responses,
    },
  },
};

writeFileSync('nc_swagger.json', JSON.stringify(swagger));
