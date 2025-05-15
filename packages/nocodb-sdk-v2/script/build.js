import { cwd } from 'node:process';
import { generateApi } from 'swagger-typescript-api';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await generateApi({
  input: resolve(__dirname, '../../nocodb/src/schema/swagger-v3.json'),
  output: resolve(cwd(), 'src/lib'),
  apiClassName: 'InternalApi',
  unwrapResponseData: true,
  httpClientType: 'axios',
});