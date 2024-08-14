import { XcActionType, XcType } from 'nocodb-sdk';
import SMTPPlugin from './SMTPPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

// @author <dean@deanlofts.xyz>

const config: XcPluginConfig = {
  builder: SMTPPlugin,
  title: 'SMTP',
  version: '0.0.3',
  // icon: 'mdi-email-outline',
  description: 'SMTP email client',
  price: 'Free',
  tags: 'Email',
  category: 'Email',
  inputs: {
    title: 'Configure Email SMTP',
    items: [
      {
        key: 'from',
        label: 'From Address',
        placeholder: 'admin@run.com',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'host',
        label: 'SMTP Server',
        placeholder: 'smtp.run.com',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'name',
        label: 'From Domain',
        placeholder: 'your-domain.com',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'port',
        label: 'SMTP Port',
        placeholder: 'Port',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'secure',
        label: 'Use Secure Connection',
        placeholder: 'Secure',
        type: XcType.Checkbox,
        required: false,
      },
      {
        key: 'ignoreTLS',
        label: 'Ignore TLS Errors',
        placeholder: 'Ignore TLS',
        type: XcType.Checkbox,
        required: false,
      },
      {
        key: 'rejectUnauthorized',
        label: 'Reject Unauthorized',
        placeholder: 'Reject Unauthorized',
        type: XcType.Checkbox,
        required: false,
      },
      {
        key: 'username',
        label: 'Username',
        placeholder: 'Username',
        type: XcType.SingleLineText,
        required: false,
      },
      {
        key: 'password',
        label: 'Password',
        placeholder: 'Password',
        type: XcType.Password,
        required: false,
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
      'Successfully installed and email notification will use SMTP configuration',
    msgOnUninstall: '',
  },
};

export default config;
