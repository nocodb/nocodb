import { XcActionType, XcType } from 'nocodb-sdk';
import type { XcForm } from 'nocodb-sdk';

const input: XcForm = {
  title: 'Configure Enterprise Edition',
  items: [
    {
      key: 'key',
      label: 'Key',
      placeholder: 'Key',
      type: XcType.Password,
      required: true,
    },
    // {
    // key: 'callback_url',
    // label: 'Callback URL',
    // placeholder: 'Callback URL',
    // type: XcType.URL,
    // required: true
    // },
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
  msgOnInstall: 'Successfully installed and enabled Enterprise Edition.',
  msgOnUninstall: '',
};

export default {
  title: 'Enterprise Edition',
  version: '0.0.1',
  logo: 'plugins/xgene.png',
  description: 'With  Enterprise Edition you will get advanced access control.',
  price: 'Free',
  tags: 'Enterprise',
  category: 'Enterprise',
  input_schema: JSON.stringify(input),
};
