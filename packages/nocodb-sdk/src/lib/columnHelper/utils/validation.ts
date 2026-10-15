import { isMobilePhone } from 'validator';

export const validateEmail = (v: string) =>
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(
    v
  );

/**
 * Phone number check shared by the server and the UI. Separators are ignored,
 * so spaced numbers like "+91 98450 12345" pass.
 */
export const isValidPhoneNumber = (v: unknown) =>
  v !== null &&
  v !== undefined &&
  isMobilePhone(String(v).replace(/[\s().-]/g, ''), 'any');
