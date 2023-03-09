import { XcActionType, XcType } from 'nocodb-sdk';
import type { XcForm } from 'nocodb-sdk';

const input: XcForm = {
  title: 'Branding',
  items: [
    {
      key: 'title',
      label: 'Title',
      placeholder: 'Title',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'logo',
      label: 'Logo',
      placeholder: 'Logo',
      type: XcType.Attachment,
      required: true,
    },
    {
      key: 'favicon',
      label: 'Favicon',
      placeholder: 'Favicon',
      type: XcType.Attachment,
      required: false,
    },
    {
      key: 'website',
      label: 'Website',
      placeholder: 'Website',
      type: XcType.URL,
      required: false,
    },
    {
      key: 'twitter',
      label: 'Twitter',
      placeholder: 'Twitter',
      type: XcType.URL,
      required: false,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      placeholder: 'Facebook',
      type: XcType.URL,
      required: false,
    },
    {
      key: 'youtube',
      label: 'Youtube',
      placeholder: 'Youtube',
      type: XcType.URL,
      required: false,
    },
  ],
  actions: [
    {
      label: 'Save',
      key: 'save',
      actionType: XcActionType.SUBMIT,
      type: XcType.Button,
    },
  ],
  msgOnInstall:
    'Successfully installed and hard refresh the browser to reflect the changes',
  msgOnUninstall: '',
};

export default {
  title: 'Branding',
  version: '0.0.1',
  logo: 'plugins/xgene.png',
  description: 'Brand details',
  price: 'Free',
  tags: 'Brand',
  category: 'Brand',
  input_schema: JSON.stringify(input),
};
