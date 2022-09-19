// import colors from 'vuetify/es5/util/colors'
import '@mdi/font/css/materialdesignicons.css' // Ensure you are using css-loader

export default function({ app }) {
  return {
    icons: {
      iconfont: 'mdi' // default - only for display purposes
    },
    theme: {
      options: {
        customProperties: true
      },
      dark: app.store.state.settings.darkTheme,
      themes: {
        dark: {
          primary: '#0989ff',
          'x-active': '#e91e63',
          textColor: '#ffffff',
          text: '#ffffff',
          textLight: '#b3b3b3',
          backgroundColor: '#565656',
          backgroundColor1: '#252525',
          backgroundColorDefault: '#1f1f1f',
          headerBg: '#0989ff'
        },
        light: {
          primary: '#1348ba',
          'x-active': '#e91e63',
          textColor: '#333333',
          text: '#333333',
          textLight: '#929292',
          backgroundColor: '#f7f7f7',
          backgroundColor1: '#f7f6f3',
          backgroundColorDefault: '#ffffff',
          headerBg: '#1348ba'
        }
      }
    }
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
