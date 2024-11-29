import { XcActionType, XcType } from 'nocodb-sdk';
import TwilioPlugin from './TwilioPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: TwilioPlugin,
  id: 'twilio',
  title: 'Twilio',
  version: '0.0.1',
  logo: 'plugins/twilio.png',
  description:
    'With Twilio, unite communications and strengthen customer relationships across your business – from marketing and sales to customer service and operations.',
  price: 'Free',
  tags: 'Chat',
  category: 'Twilio',
  inputs: {
    title: 'Configure Twilio',
    items: [
      {
        key: 'sid',
        label: 'Account SID',
        placeholder: 'Account SID',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'token',
        label: 'Auth Token',
        placeholder: 'Auth Token',
        type: XcType.Password,
        required: true,
      },
      {
        key: 'from',
        label: 'From Phone Number',
        placeholder: 'From Phone Number',
        type: XcType.SingleLineText,
        required: true,
      },
    ],
    actions: [
      {
        label: 'Test',
        placeholder: 'Test',
        key: 'test',
        actionType: XcActionType.TEST,
        type: XcType.Button,
      },
      {
        label: 'Save',
        placeholder: 'Save',
        key: 'save',
        actionType: XcActionType.SUBMIT,
        type: XcType.Button,
      },
    ],
    msgOnInstall:
      'Successfully installed and Twilio is enabled for notification.',
    msgOnUninstall: '',
  },
};

export default config;
