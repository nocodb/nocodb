import type { XcForm } from 'nocodb-sdk';
import { XcActionType, XcType } from 'nocodb-sdk';

const input: XcForm = {
  title: 'Configure Metadata LRU Cache',
  items: [
    {
      key: 'max',
      label: 'Maximum Size',
      placeholder: 'Maximum Size',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'maxAge',
      label: 'Maximum Age(in ms)',
      placeholder: 'Maximum Age(in ms)',
      type: XcType.SingleLineText,
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
  msgOnInstall: 'Successfully updated LRU cache options.',
  msgOnUninstall: '',
};

export default {
  title: 'Metadata LRU Cache',
  version: '0.0.1',
  logo: 'plugins/xgene.png',
  description: 'A cache object that deletes the least-recently-used items.',
  price: 'Free',
  tags: 'Cache',
  category: 'Cache',
  active: true,
  input: JSON.stringify({
    max: 500,
    maxAge: 1000 * 60 * 60 * 24,
  }),
  input_schema: JSON.stringify(input),
};
