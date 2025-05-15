import { XcActionType, XcType } from 'nocodb-sdk';
import UpCloudPlugin from './UpCloudPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: UpCloudPlugin,
  id: 'upcloud',
  title: 'UpCloud',
  recoveryTitle: 'UpCloud Object Storage',
  version: '0.0.4',
  logo: 'plugins/upcloud.png',
  description:
    'The perfect home for your data. Thanks to the S3-compatible programmable interface,\n' +
    'you have a host of options for existing tools and code implementations.\n',
  tags: 'Storage',
  inputs: {
    title: 'Configure UpCloud Object Storage',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'endpoint',
        label: 'Endpoint',
        placeholder: 'Endpoint',
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
      'Successfully configured! Attachments will now be stored in UpCloud Object Storage.',
    msgOnUninstall: '',
  },
  category: 'Storage',
};

export default config;
