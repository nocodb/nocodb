import type { XcForm } from 'nocodb-sdk';
import { XcActionType, XcType } from 'nocodb-sdk';

const input: XcForm = {
  title: 'Configure Google Auth',
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
    'Successfully installed and configured Google Authentication, restart NocoDB',
  msgOnUninstall: '',
};

export default {
  title: 'Google',
  version: '0.0.1',
  logo: 'plugins/google.png',
  description: 'Google OAuth2 login.',
  price: 'Free',
  tags: 'Authentication',
  category: 'Google',
  input_schema: JSON.stringify(input),
};
