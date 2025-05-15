import { XcActionType, XcType } from 'nocodb-sdk';
import BackblazePlugin from './BackblazePlugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: BackblazePlugin,
  id: 'backblaze',
  title: 'Backblaze',
  recoveryTitle: 'Backblaze B2',
  version: '0.0.5',
  logo: 'plugins/backblaze.jpeg',
  tags: 'Storage',
  description:
    'Backblaze B2 is enterprise-grade, S3 compatible storage that companies around the world use to store and serve data while improving their cloud OpEx vs. Amazon S3 and others.',
  inputs: {
    title: 'Configure Backblaze B2',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'region',
        label: 'Region',
        placeholder: 'e.g. us-west-001',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'access_key',
        label: 'Access Key',
        placeholder: 'i.e. keyID in App Keys',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'access_secret',
        label: 'Access Secret',
        placeholder: 'i.e. applicationKey in App Keys',
        type: XcType.Password,
        required: true,
      },
      {
        key: 'acl',
        label: 'Access Control Lists (ACL)',
        placeholder: 'Default set to public-read',
        type: XcType.SingleLineText,
        required: false,
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
      'Successfully configured! Attachments will now be stored in Backblaze B2.',
    msgOnUninstall: '',
  },
  category: 'Storage',
};

export default config;
