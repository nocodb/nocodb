import { XcActionType, XcType } from 'nocodb-sdk';
import OvhCloud from './OvhCloudPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: OvhCloud,
  title: 'OvhCloud Object Storage',
  version: '0.0.1',
  logo: 'plugins/ovhCloud.png',
  tags: 'Storage',
  description:
    'Upload your files to a space that you can access via HTTPS using the OpenStack Swift API, or the S3 API. ',
  inputs: {
    title: 'Configure OvhCloud Object Storage',
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
      'Successfully installed and attachment will be stored in OvhCloud Object Storage',
    msgOnUninstall: '',
  },
  category: 'Storage',
};

export default config;
