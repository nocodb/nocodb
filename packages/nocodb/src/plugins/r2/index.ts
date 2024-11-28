import { XcActionType, XcType } from 'nocodb-sdk';
import R2Plugin from './R2Plugin';
import type { XcPluginConfig } from '~/types/nc-plugin';

const config: XcPluginConfig = {
  builder: R2Plugin,
  id: 'cloudflare-r2',
  title: 'Cloudflare R2',
  recoveryTitle: 'Cloudflare R2 Storage',
  version: '0.0.3',
  logo: 'plugins/r2.png',
  description:
    'Cloudflare R2 is an S3-compatible, zero egress-fee, globally distributed object storage.',
  tags: 'Storage',
  inputs: {
    title: 'Configure Cloudflare R2 Storage',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'hostname',
        label: 'Host Name',
        placeholder: 'e.g.: *****.r2.cloudflarestorage.com',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'access_key',
        label: 'Access Key',
        placeholder: 'Access Key',
        type: XcType.SingleLineText,
        required: true,
      },
      {
        key: 'access_secret',
        label: 'Access Secret',
        placeholder: 'Access Secret',
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
      'Successfully configured! Attachments will now be stored in Cloudflare R2 Storage.',
    msgOnUninstall: '',
  },
  category: 'Storage',
};

export default config;
