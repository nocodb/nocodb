import * as swaggerV3 from '../ee/schema/swagger-v3.json';
import * as swagger from './swagger.json';

console.log(swagger);
console.log(swaggerV3);

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

export { swaggerV3 };
