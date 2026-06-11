import { PluginCategory, XcActionType, XcType } from 'nocodb-sdk';
import S3Plugin from './S3Plugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: S3Plugin,
  id: 'aws-s3',
  title: 'S3',
  version: '0.0.6',
  logo: 'plugins/s3.png',
  description:
    'Amazon Simple Storage Service (Amazon S3) is an object storage service that offers industry-leading scalability, data availability, security, and performance.',
  inputs: {
    title: 'Configure Amazon S3',
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
        key: 'endpoint',
        label: 'Endpoint',
        placeholder: 'Endpoint',
        type: XcType.SingleLineText,
        required: false,
      },
      {
        key: 'access_key',
        label: 'Access Key',
        placeholder: 'Access Key',
        type: XcType.SingleLineText,
        required: false,
      },
      {
        key: 'access_secret',
        label: 'Access Secret',
        placeholder: 'Access Secret',
        type: XcType.Password,
        required: false,
      },
      {
        key: 'acl',
        label: 'Access Control Lists (ACL)',
        placeholder: '',
        type: XcType.SingleLineText,
        required: false,
      },
      {
        key: 'force_path_style',
        label: 'Force Path Style',
        placeholder: 'Default set to false',
        type: XcType.Checkbox,
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
      'Successfully configured! Attachments will now be stored in AWS S3.',
    msgOnUninstall: '',
  },
  category: PluginCategory.STORAGE,
  tags: 'Storage',
};

export default config;
