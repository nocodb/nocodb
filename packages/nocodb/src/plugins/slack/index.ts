import { XcActionType, XcType } from 'nocodb-sdk';
import SlackPlugin from './SlackPlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: SlackPlugin,
  id: 'slack',
  title: 'Slack',
  version: '0.0.1',
  logo: 'plugins/slack.webp',
  description:
    'Slack brings team communication and collaboration into one place so you can get more work done, whether you belong to a large enterprise or a small business. ',
  price: 'Free',
  tags: 'Chat',
  category: 'Chat',
  inputs: {
    title: 'Configure Slack',
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
      'Successfully installed and Slack is enabled for notification.',
    msgOnUninstall: '',
  },
};

export default config;
