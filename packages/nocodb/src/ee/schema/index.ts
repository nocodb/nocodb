import * as swaggerCE from 'src/schema/swagger.json';
import { mergeSwaggerSchema } from 'nocodb-sdk';
import * as swaggerEE from './swagger.json';
import * as swaggerV3 from '~/schema/swagger-v3.json';
export { swaggerV3Validation } from 'src/schema';

// merge EE and CE swagger schemas
const swagger = mergeSwaggerSchema(
  mergeSwaggerSchema(swaggerCE, swaggerEE),
  swaggerV3,
);

export default swagger;
export { swaggerV3 };
