import { XcActionType, XcType } from 'nocodb-sdk';
import TeamsPlugin from './TeamsPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: TeamsPlugin,
  title: 'Microsoft Teams',
  version: '0.0.1',
  logo: 'plugins/teams.ico',
  description:
    'Microsoft Teams is for everyone · Instantly go from group chat to video call with the touch of a button.',
  price: 'Free',
  tags: 'Chat',
  category: 'Chat',
  inputs: {
    title: 'Configure Microsoft Teams',
    array: true,
    items: [
      {
        key: 'channel',
        label: 'Channel Name',
        placeholder: 'Channel Name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'webhook_url',
        label: 'Webhook URL',
        placeholder: 'Webhook URL',
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
    msgOnInstall:
      'Successfully installed and Microsoft Teams is enabled for notification.',
    msgOnUninstall: '',
  },
};

export default config;
