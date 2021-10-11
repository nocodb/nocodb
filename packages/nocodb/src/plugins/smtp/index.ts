import { XcActionType, XcType } from 'nc-common';
import { XcPluginConfig } from 'nc-plugin';

import SMTPPlugin from './SMTPPlugin';

// @author <dean@deanlofts.xyz>

const config: XcPluginConfig = {
  builder: SMTPPlugin,
  title: 'SMTP',
  version: '0.0.1',
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
        label: 'From',
        placeholder: 'eg: admin@example.com',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'host',
        label: 'Host',
        placeholder: 'eg: smtp.example.com',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'port',
        label: 'Port',
        placeholder: 'Port',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'secure',
        label: 'Secure',
        placeholder: 'Secure',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'ignoreTLS',
        label: 'IgnoreTLS',
        placeholder: 'IgnoreTLS',
        type: XcType.SingleLineText,
        required: false
      },
      {
        key: 'username',
        label: 'Username',
        placeholder: 'Username',
        type: XcType.SingleLineText,
        required: false
      },
      {
        key: 'password',
        label: 'Password',
        placeholder: 'Password',
        type: XcType.Password,
        required: false
      }
    ],
    actions: [
      {
        label: 'Test',
        key: 'test',
        actionType: XcActionType.TEST,
        type: XcType.Button
      },
      {
        label: 'Save',
        key: 'save',
        actionType: XcActionType.SUBMIT,
        type: XcType.Button
      }
    ],
    msgOnInstall:
      'Successfully installed and email notification will use SMTP configuration',
    msgOnUninstall: ''
  }
};

export default config;
