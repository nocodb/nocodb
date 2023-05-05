import { XcActionType, XcType } from 'nocodb-sdk';
import SESPlugin from './SESPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: SESPlugin,
  title: 'SES',
  version: '0.0.1',
  logo: 'plugins/aws.png',
  description:
    'Amazon Simple Email Service (SES) is a cost-effective, flexible, and scalable email service that enables developers to send mail from within any application.',
  price: 'Free',
  tags: 'Email',
  category: 'Email',
  inputs: {
    title: 'Configure Amazon Simple Email Service (SES)',
    items: [
      {
        key: 'from',
        label: 'From',
        placeholder: 'From',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'region',
        label: 'Region',
        placeholder: 'Region',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'access_key',
        label: 'Access Key',
        placeholder: 'Access Key',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'access_secret',
        label: 'Access Secret',
        placeholder: 'Access Secret',
        type: XcType.Password,
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
      'Successfully installed and email notification will use Amazon SES',
    msgOnUninstall: '',
  },
};

export default config;
