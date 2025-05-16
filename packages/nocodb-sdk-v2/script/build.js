import { dirname, resolve } from 'node:path';
import { cwd } from 'node:process';
import { fileURLToPath } from 'node:url';
import { generateApi } from 'swagger-typescript-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

await generateApi({
  input: resolve(__dirname, '../../nocodb/src/schema/swagger-v3.json'),
  output: resolve(cwd(), 'src/lib'),
  apiClassName: 'InternalApi',
  unwrapResponseData: true,
  httpClientType: 'axios',
});
