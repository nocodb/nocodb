import deepClone from 'src/helpers/deepClone';
import * as swaggerV3ValidationPatch from './swagger-v3-validation-patch.json';
import * as swaggerV3 from './swagger-v3.json';
import * as swagger from './swagger.json';

export default {
  ...swagger,
  components: {
    ...swagger.components,
    schemas: {
      ...swagger.components.schemas,
      ...swaggerV3.components.schemas,
    },
  },
};

const swaggerV3Validation = deepClone(swaggerV3);
for (const [key, value] of Object.entries(
  swaggerV3ValidationPatch.components.schemas,
)) {
  swaggerV3Validation.components.schemas[key] = value;
}

export { swaggerV3, swaggerV3Validation };
