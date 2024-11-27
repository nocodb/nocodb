import { XcActionType, XcType } from 'nocodb-sdk';
import LinodeObjectStoragePlugin from './LinodeObjectStoragePlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: LinodeObjectStoragePlugin,
  id: 'linode',
  recoveryTitle: 'Linode Object Storage',
  title: 'Linode',
  version: '0.0.4',
  logo: 'plugins/linode.svg',
  tags: 'Storage',
  description:
    'S3-compatible Linode Object Storage makes it easy and more affordable to manage unstructured data such as content assets, as well as sophisticated and data-intensive storage challenges around artificial intelligence and machine learning.',
  inputs: {
    title: 'Configure Linode Object Storage',
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
      {
        key: 'acl',
        label: 'Access Control Lists (ACL)',
        placeholder: 'Default set to public-read',
        type: XcType.SingleLineText,
        required: false,
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
      'Successfully configured! Attachments will now be stored in Linode Object Storage.',
    msgOnUninstall: '',
  },
  category: 'Storage',
};

export default config;
