import * as swagger3 from '../ee/schema/swagger-v3.json';
import * as swagger from './swagger.json';

export default {
  ...swagger,
  components: {
    ...swagger.components,
    schemas: {
      ...swagger.components.schemas,
      ...swagger3.components.schemas,
    },
  },
};
