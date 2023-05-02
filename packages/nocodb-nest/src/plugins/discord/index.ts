import { XcActionType, XcType } from 'nocodb-sdk';
import DiscordPlugin from './DiscordPlugin';
import type { XcPluginConfig } from 'nc-plugin';

const config: XcPluginConfig = {
  builder: DiscordPlugin,
  title: 'Discord',
  version: '0.0.1',
  logo: 'plugins/discord.png',
  description:
    'Discord is the easiest way to talk over voice, video, and text. Talk, chat, hang out, and stay close with your friends and communities.',
  price: 'Free',
  tags: 'Chat',
  category: 'Chat',
  inputs: {
    title: 'Configure Discord',
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
        type: XcType.Password,
        placeholder: 'Webhook URL',
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
      'Successfully installed and Discord is enabled for notification.',
    msgOnUninstall: '',
  },
};

export default config;
