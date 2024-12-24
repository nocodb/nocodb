const { writeFileSync, readFileSync } = require('fs');
// import {mergeSwaggerSchema} from "../../src";

const swaggerEE =  JSON.parse(readFileSync('../nocodb/src/ee/schema/swagger.json', 'utf8'));
const swaggerV3 =  JSON.parse(readFileSync('../nocodb/src/ee/schema/swagger-v3.json', 'utf8'));
const swaggerCE = JSON.parse(readFileSync('../nocodb/src/schema/swagger.json', 'utf8'));
const swagger = {
...swaggerCE,
...swaggerEE,
  paths: {
...swaggerCE.paths,
...swaggerEE.paths,
    ...swaggerV3.paths,
},
  components: {
  ...swaggerCE.components,
  ...swaggerEE.components,
      schemas: {
    ...swaggerCE.components.schemas,
    ...swaggerEE.components.schemas,
    ...swaggerV3.components.schemas,
    },
    responses: {
    ...swaggerCE.components.responses,
    ...swaggerEE.components.responses,
    },
  },
};

writeFileSync('nc_swagger.json', JSON.stringify(swagger));
