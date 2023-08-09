import * as swaggerCE from 'src/schema/swagger.json';
import { mergeSwaggerSchema } from 'nocodb-sdk';
import * as swaggerEE from './swagger.json';

// merge EE and CE swagger schemas
const swagger = mergeSwaggerSchema(swaggerCE, swaggerEE);

export default swagger;
