import { XcActionType, XcForm, XcType } from 'nc-common';

const input: XcForm = {
  title: 'Configure Amazon Simple Email Service(SES)',
  items: [
    {
      key: 'from',
      label: 'From',
      placeholder: 'From',
      type: XcType.SingleLineText,
      required: true
    },
    {
      key: 'host',
      label: 'Jost',
      placeholder: 'Jost',
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
      key: 'username',
      label: 'Username',
      placeholder: 'Username',
      type: XcType.SingleLineText,
      required: true
    },
    {
      key: 'password',
      label: 'Password',
      placeholder: 'Password',
      type: XcType.Password,
      required: true
    }
  ],
  actions: [
    {
      label: 'Test',
      placeholder: 'Test',
      key: 'test',
      actionType: XcActionType.TEST,
      type: XcType.Button
    },
    {
      label: 'Save',
      placeholder: 'Save',
      key: 'save',
      actionType: XcActionType.SUBMIT,
      type: XcType.Button
    }
  ],
  msgOnInstall:
    'Successfully installed and email notification will use Amazon SES',
  msgOnUninstall: ''
};

export default {
  title: 'SES',
  version: '0.0.1',
  logo: 'plugins/aws.png',
  description:
    'Amazon Simple Email Service (SES) is a cost-effective, flexible, and scalable email service that enables developers to send mail from within any application.',
  price: 'Free',
  tags: 'Email',
  category: 'Email',
  input_schema: JSON.stringify(input)
};
