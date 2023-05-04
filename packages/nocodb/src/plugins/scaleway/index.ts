import { XcActionType, XcType } from 'nocodb-sdk';
import ScalewayObjectStoragePlugin from './ScalewayObjectStoragePlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: ScalewayObjectStoragePlugin,
  title: 'Scaleway Object Storage',
  version: '0.0.1',
  logo: 'plugins/scaleway.png',
  tags: 'Storage',
  description:
    'Scaleway Object Storage is an S3-compatible object store from Scaleway Cloud Platform.',
  inputs: {
    title: 'Setup Scaleway',
    items: [
      {
        key: 'bucket',
        label: 'Bucket name',
        placeholder: 'Bucket name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'region',
        label: 'Region of bucket',
        placeholder: 'Region of bucket',
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
    msgOnInstall: 'Successfully installed Scaleway Object Storage',
    msgOnUninstall: '',
  },
  category: 'Storage',
};

export default config;
