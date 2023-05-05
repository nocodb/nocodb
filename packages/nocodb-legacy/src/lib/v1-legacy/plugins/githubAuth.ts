import { XcActionType, XcType } from 'nocodb-sdk';
import type { XcForm } from 'nocodb-sdk';

const input: XcForm = {
  title: 'Configure Github Auth',
  items: [
    {
      key: 'client_id',
      label: 'Client ID',
      placeholder: 'Client ID',
      type: XcType.SingleLineText,
      required: true,
    },
    {
      key: 'client_secret',
      label: 'Client Secret',
      placeholder: 'Client Secret',
      type: XcType.Password,
      required: true,
    },
    {
      key: 'redirect_url',
      label: 'Redirect URL',
      placeholder: 'Redirect URL',
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
  msgOnInstall:
    'Successfully installed and configured Github Authentication, restart NocoDB',
  msgOnUninstall: '',
};

export default {
  title: 'Github',
  version: '0.0.1',
  logo: 'plugins/github.png',
  description: 'Github OAuth2 login.',
  price: 'Free',
  tags: 'Authentication',
  category: 'Github',
  input_schema: JSON.stringify(input),
};
