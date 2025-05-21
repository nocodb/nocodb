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

export { swaggerV3 };
