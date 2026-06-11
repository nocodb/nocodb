import { NcError } from './ncError';
import type { NcApiVersion } from 'nocodb-sdk';

export default function validateParams(
  props: string[],
  body: any,
  option?: {
    api_version?: NcApiVersion;
  },
) {
  for (const prop of props) {
    if (!(prop in body)) {
      NcError.get({ api_version: option?.api_version }).invalidRequestBody(
        `Missing '${prop}' property in request body`,
      );
    }
  }
}
