import { XcActionType, XcType } from 'nocodb-sdk';
import MailerSendPlugin from './MailerSendPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: MailerSendPlugin,
  id: 'mailersend',
  title: 'MailerSend',
  version: '0.0.2',
  logo: 'plugins/mailersend.svg',
  // icon: 'mdi-email-outline',
  description: 'MailerSend email client',
  price: 'Free',
  tags: 'Email',
  category: 'Email',
  inputs: {
    title: 'Configure MailerSend',
    items: [
      {
        key: 'api_key',
        label: 'API key',
        placeholder: 'eg: ***************',
        type: XcType.Password,
        required: true,
      },
      {
        key: 'from',
        label: 'From',
        placeholder: 'eg: admin@run.com',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'from_name',
        label: 'From name',
        placeholder: 'eg: Adam',
        type: XcType.SingleLineText,
        required: true,
      },
    ],
    actions: [
      {
        label: 'Test',
        key: 'test',
        actionType: XcActionType.TEST,
        type: XcType.Button,
      },
      {
        label: 'Save',
        key: 'save',
        actionType: XcActionType.SUBMIT,
        type: XcType.Button,
      },
    ],
    msgOnInstall:
      'Successfully configured! Email notifications are now set up using MailerSend.',
    msgOnUninstall: '',
  },
};

export default config;
