import { XcActionType, XcType } from 'nocodb-sdk';
import AzureBlobPlugin from './AzureBlobPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: AzureBlobPlugin,
  id: 'azure-blob',
  title: 'Azure Blob Storage',
  version: '0.0.1',
  logo: 'plugins/azure-blob.svg',
  description:
    'Azure Blob Storage is Microsoft’s object storage solution for the cloud, optimized for storing massive amounts of unstructured data.',
  price: 'Free',
  tags: 'Storage',
  category: 'Storage',
  inputs: {
    title: 'Configure Azure Blob Storage',
    items: [
      {
        key: 'container',
        label: 'Container Name',
        placeholder: 'Container Name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'connection_string',
        label: 'Connection String',
        placeholder: 'Connection string, or use account name and key below',
        type: XcType.Password,
        required: false,
      },
      {
        key: 'account_name',
        label: 'Account Name',
        placeholder: 'Storage Account Name',
        type: XcType.SingleLineText,
        required: false,
      },
      {
        key: 'account_key',
        label: 'Account Key',
        placeholder: 'Storage Account Key',
        type: XcType.Password,
        required: false,
      },
      {
        key: 'endpoint',
        label: 'Endpoint',
        placeholder: 'e.g.: https://<account>.blob.core.windows.net',
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
      'Successfully configured! Attachments will now be stored in Azure Blob Storage.',
    msgOnUninstall: '',
  },
};

export default config;
