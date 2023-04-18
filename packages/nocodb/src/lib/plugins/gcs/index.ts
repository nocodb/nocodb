import { XcActionType, XcType } from 'nocodb-sdk';
import GcsPlugin from './GcsPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: GcsPlugin,
  title: 'GCS',
  version: '0.0.2',
  logo: 'plugins/gcs.png',
  description:
    'Google Cloud Storage is a RESTful online file storage web service for storing and accessing data on Google Cloud Platform infrastructure.',
  price: 'Free',
  tags: 'Storage',
  category: 'Storage',
  inputs: {
    title: 'Configure Google Cloud Storage',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'client_email',
        label: 'Client Email',
        placeholder: 'Client Email',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'private_key',
        label: 'Private Key',
        placeholder: 'Private Key',
        type: XcType.Password,
        required: true,
      },
      {
        key: 'project_id',
        label: 'Project ID',
        placeholder: 'Project ID',
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
      'Successfully installed and attachment will be stored in Google Cloud Storage',
    msgOnUninstall: '',
  },
};

export default config;
