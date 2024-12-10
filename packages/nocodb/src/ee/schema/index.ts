import * as swaggerCE from 'src/schema/swagger.json';
import { mergeSwaggerSchema } from 'nocodb-sdk';
import * as swaggerEE from './swagger.json';
import * as swagger3 from '~/schema/swagger-v3.json';

// merge EE and CE swagger schemas
const swagger = mergeSwaggerSchema(
  mergeSwaggerSchema(swaggerCE, swaggerEE),
  swagger3,
);

export default swagger;
