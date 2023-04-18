import { XcActionType, XcType } from 'nocodb-sdk';
import VultrPlugin from './VultrPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: VultrPlugin,
  title: 'Vultr Object Storage',
  version: '0.0.2',
  logo: 'plugins/vultr.png',
  description:
    'Using Vultr Object Storage can give flexibility and cloud storage that allows applications greater flexibility and access worldwide.',
  tags: 'Storage',
  inputs: {
    title: 'Configure Vultr Object Storage',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'hostname',
        label: 'Host Name',
        placeholder: 'e.g.: ewr1.vultrobjects.com',
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
      'Successfully installed and attachment will be stored in Vultr Object Storage',
    msgOnUninstall: '',
  },
  category: 'Storage',
};

export default config;
