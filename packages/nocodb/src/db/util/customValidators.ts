import { isValidURL } from 'nocodb-sdk';
import Validator from 'validator';

export const customValidators = {
  isCurrency: Validator['isFloat'],
  isURL: (str: string, extraProps?: validator.IsURLOptions) => {
    return isValidURL(str, {
      ...(extraProps ?? {}),
      require_tld:
        process.env.NC_WEBHOOK_ALLOW_PRIVATE_NETWORK !== 'true' &&
        process.env.NC_ALLOW_LOCAL_HOOKS !== 'true',
    });
  },
};
