import type { XcForm } from 'nocodb-sdk';
import { XcActionType, XcType } from 'nocodb-sdk';

const input: XcForm = {
  title: 'Configure Azure Storage',
  items: [
    {
      key: 'account',
      label: 'Azure Account Name',
      placeholder: 'Azure Account Name',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'container',
      label: 'Storage Container',
      placeholder: 'Storage Container',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'access_key',
      label: 'Access Key',
      placeholder: 'Access Key',
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
  msgOnInstall: 'Successfully installed and attachment will be stored in Azure',
  msgOnUninstall: '',
};

export default {
  title: 'Azure',
  version: '0.0.1',
  logo: 'plugins/azure.png',
  description:
    "Azure Blob storage is Microsoft's object storage solution for the cloud. Blob storage is optimized for storing massive amounts of unstructured data, such as text or binary data.",
  price: 'Free',
  tags: 'Storage',
  category: 'Storage',
  input_schema: JSON.stringify(input),
};
