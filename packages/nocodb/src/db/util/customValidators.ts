import { isValidPhoneNumber, isValidURL } from 'nocodb-sdk';
import Validator from 'validator';

export const customValidators = {
  isCurrency: Validator['isFloat'],
  // Same check as the UI, which accepts spaced numbers like "+91 98450 12345".
  isMobilePhone: (str: string) => isValidPhoneNumber(str),
  isURL: (str: string, extraProps?: validator.IsURLOptions) => {
    return isValidURL(str, {
      ...(extraProps ?? {}),
      // TODO: respect NC_DISABLE_SSRF_PROTECTION here
      require_tld:
        process.env.NC_WEBHOOK_ALLOW_PRIVATE_NETWORK !== 'true' &&
        process.env.NC_ALLOW_LOCAL_HOOKS !== 'true',
    });
  },
};
