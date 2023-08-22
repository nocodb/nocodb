import { XcActionType, XcType } from 'nocodb-sdk';
import MattermostPlugin from './MattermostPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: MattermostPlugin,
  title: 'Mattermost',
  version: '0.0.1',
  logo: 'plugins/mattermost.png',
  description:
    'Mattermost brings all your team communication into one place, making it searchable and accessible anywhere.',
  price: 'Free',
  tags: 'Chat',
  category: 'Chat',
  inputs: {
    title: 'Configure Mattermost',
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
      'Successfully installed and Mattermost is enabled for notification.',
    msgOnUninstall: '',
  },
};

export default config;
