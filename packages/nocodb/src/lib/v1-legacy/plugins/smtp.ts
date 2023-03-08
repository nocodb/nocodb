import type { XcForm } from 'nocodb-sdk';
import { XcActionType, XcType } from 'nocodb-sdk';

const input: XcForm = {
  title: 'Configure Email SMTP',
  items: [
    {
      key: 'from',
      label: 'From',
      placeholder: 'eg: admin@run.com',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'host',
      label: 'Host',
      placeholder: 'eg: smtp.run.com',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'port',
      label: 'Port',
      placeholder: 'Port',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'secure',
      label: 'Secure',
      placeholder: 'Secure',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'ignoreTLS',
      label: 'Ignore TLS',
      placeholder: 'Ignore TLS',
      type: XcType.Checkbox,
      required: true,
    },
    {
      key: 'username',
      label: 'Username',
      placeholder: 'Username',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'password',
      label: 'Password',
      placeholder: 'Password',
      type: XcType.Password,
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
    'Successfully installed and email notification will use SMTP configuration',
  msgOnUninstall: '',
};

export default {
  title: 'SMTP',
  version: '0.0.1',
  icon: 'mdi-email-outline',
  description: 'SMTP email client',
  price: 'Free',
  tags: 'Email',
  category: 'Email',
  input_schema: JSON.stringify(input),
};
