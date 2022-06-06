import { XcActionType, XcType } from 'nocodb-sdk';
import { XcPluginConfig } from 'nc-plugin';
import ScalewayObjectStoragePlugin from './ScalewayObjectStoragePlugin';

const config: XcPluginConfig = {
  builder: ScalewayObjectStoragePlugin,
  title: 'Scaleway Object Storage',
  version: '0.0.1',
  logo: 'plugins/scaleway.png',
  tags: 'Storage',
  description:
    'Scaleway Object Storage is an S3-compatible object store from Scaleway Cloud Platform.',
  inputs: {
    title: 'Setup Scaleway',
    items: [
      {
        key: 'bucket',
        label: 'Bucket name',
        placeholder: 'Bucket name',
        type: XcType.SingleLineText,
        required: true
      },
      {
        key: 'region',
        label: 'Region of bucket',
        placeholder: 'Region of bucket',
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
    msgOnInstall: 'Successfully installed Scaleway Object Storage',
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
