import { XcActionType, XcType } from 'nocodb-sdk';
import SpacesPlugin from './SpacesPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: SpacesPlugin,
  title: 'Spaces',
  version: '0.0.1',
  logo: 'plugins/spaces.png',
  description:
    'Store & deliver vast amounts of content with a simple architecture.',
  price: 'Free',
  tags: 'Storage',
  category: 'Storage',
  inputs: {
    title: 'DigitalOcean Spaces',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
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
      'Successfully installed and attachment will be stored in DigitalOcean Spaces',
    msgOnUninstall: '',
  },
};

export default config;
