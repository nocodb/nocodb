import { XcActionType, XcType } from 'nc-common';
import { XcPluginConfig } from 'nc-plugin';

import BackblazePlugin from './BackblazePlugin';

const config: XcPluginConfig = {
  builder: BackblazePlugin,
  title: 'Backblaze B2',
  version: '0.0.1',
  logo: 'plugins/backblaze.jpeg',
  tags: 'Storage',
  description:
    'Backblaze B2 is enterprise-grade, S3 compatible storage that companies around the world use to store and serve data while improving their cloud OpEx vs. Amazon S3 and others.',
  inputs: {
    title: 'Configure Backblaze B2',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'region',
        label: 'Region',
        placeholder: 'Region',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'access_key',
        label: 'Access Key',
        placeholder: 'Access Key',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'access_secret',
        label: 'Access Secret',
        placeholder: 'Access Secret',
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
      'Successfully installed and attachment will be stored in Backblaze B2',
    msgOnUninstall: ''
  },
  category: 'Storage'
};

export default config;
