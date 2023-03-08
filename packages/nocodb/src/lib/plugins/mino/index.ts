import { XcActionType, XcType } from 'nocodb-sdk';
import S3Plugin from './MinioPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: S3Plugin,
  title: 'Minio',
  version: '0.0.1',
  logo: 'plugins/minio.png',
  description:
    'MinIO is a High Performance Object Storage released under Apache License v2.0. It is API compatible with Amazon S3 cloud storage service.',
  price: 'Free',
  tags: 'Storage',
  category: 'Storage',
  inputs: {
    title: 'Configure Minio',
    items: [
      {
        key: 'endPoint',
        label: 'Minio Endpoint',
        placeholder: 'Minio Endpoint',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'port',
        label: 'Port',
        placeholder: 'Port',
        type: XcType.Number,
        required: true,
      },
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
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
        key: 'useSSL',
        label: 'Use SSL',
        placeholder: 'Use SSL',
        type: XcType.Checkbox,
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
      'Successfully installed and attachment will be stored in Minio',
    msgOnUninstall: '',
  },
};

export default config;
