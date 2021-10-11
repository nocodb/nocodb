import { XcActionType, XcType } from 'nc-common';
import { XcPluginConfig } from 'nc-plugin';

import ScalewayObjectStoragePlugin from './ScalewayObjectStoragePlugin';

const config: XcPluginConfig = {
  builder: ScalewayObjectStoragePlugin,
  title: 'Scaleway Object Storage',
  version: '0.0.1',
  logo: 'plugins/scaleway.png',
  tags: 'Storage',
  description:
    'S3-compatible Scaleway Object Storage makes it easy and more affordable to store and access data on Scaleway Cloud Platform infrastructure. The service also gives a 75GB free storage and external outgoing transfer on Object Storage every month',
  inputs: {
    title: 'Configure Scaleway Object Storage',
    items: [
      {
        key: 'bucket',
        label: 'Bucket Name',
        placeholder: 'Bucket Name',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'region',
        label: 'Region',
        placeholder: 'Region',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'access_key',
        label: 'Access Key',
        placeholder: 'Access Key',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'access_secret',
        label: 'Access Secret',
        placeholder: 'Access Secret',
        type: XcType.Password,
        required: true
      }
    ],
    actions: [
      {
        label: 'Test',
        placeholder: 'Test',
        key: 'test',
        actionType: XcActionType.TEST,
        type: XcType.Button
      },
      {
        label: 'Save',
        placeholder: 'Save',
        key: 'save',
        actionType: XcActionType.SUBMIT,
        type: XcType.Button
      }
    ],
    msgOnInstall:
      'Successfully installed and attachment will be stored in Scaleway Object Storage',
    msgOnUninstall: ''
  },
  category: 'Storage'
};

export default config;

/**
 * @copyright Copyright (c) 2021, Bhanu P Chaudhary <bhanu423@gmail.com>
 *
 * @author Bhanu P Chaudhary <bhanu423@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
