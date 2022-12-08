import { XcEmail } from '../../../interface/IEmailAdapter';

export default {
  init: async () => {
    return true;
  },
  test: async () => {
    return true;
  },
  mailSend: async (mailInfo: XcEmail) => {
    return mailInfo;
  },
}