<template>

  <div>

    <h3 class="text-center mb-5 grey--text text--darken-2">Appearance</h3>

    <v-simple-table dense style="">
      <template v-slot:default>
        <tbody>
        <tr>
          <td>Dark Mode</td>
          <td>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-icon @click="toggleDarkTheme" v-on="on" x-large
                        :color="$vuetify.theme.dark ? 'primary':'primary'">
                  mdi-bat
                </v-icon>
              </template>
              <h3 class="pa-3">
                {{ $vuetify.theme.dark ? 'It does come in Black' : 'Does it come in Black ?' }}
                <i></i>
              </h3>
            </v-tooltip>
          </td>
        </tr>
        <tr>
          <td>Show metatables</td>
          <td>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-checkbox v-model="showMetatable" v-on="on" x-large
                            color="primary">
                  mdi-bat
                </v-checkbox>
              </template>
              Show/hide metatables
            </v-tooltip>
          </td>
        </tr>
        <tr>
          <td>Show Screensaver</td>
          <td>
            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-checkbox v-model="showScreensaver" v-on="on" x-large
                            color="primary">
                  mdi-bat
                </v-checkbox>
              </template>
              Show/hide metatables
            </v-tooltip>
          </td>
        </tr>
        <tr>
          <td>Language</td>
          <td>
            <v-radio-group v-model="language" row>
              <v-radio
                v-for="{label,value} in languages"
                :key="value"
                :label="label"
                :value="value"
              ></v-radio>
            </v-radio-group>
          </td>
        </tr>
        <tr>
          <td>Themes</td>
          <td class="pa-1">
            <v-list rounded>
              <!--              <v-subheader>REPORTS</v-subheader>-->
              <v-list-item-group color="primary" v-model="item">
                <v-list-item
                  class="mb-n1"
                  v-for="(t,i) in themes"
                  :key="i"
                  :value="i"
                  @click.native.prevent.stop="changeTheme(t,i)"
                >
                  <v-list-item-content class="py-0">
                    <div class="d-flex align-center" style="width:100%">
                      <div style="width: 100px">{{ i }}</div>
                      <div class="flex-grow-1">
                        <v-container fluid class="pa-0">
                          <v-row>
                            <v-col class="mx-2" style="height: 20px" v-for="(col,key) in t"
                                   :style="{backgroundColor: col}"
                                   :key="key">
                            </v-col>
                          </v-row>
                        </v-container>
                      </div>
                    </div>
                  </v-list-item-content>

                </v-list-item>
                <v-list-item
                  class="mb-n2"
                  value="Custom"
                  @click.native.prevent.stop="changeTheme(customTheme,'Custom')">
                  <v-list-item-content class="py-0">
                    <div class="d-flex align-center" style="width:100%">
                      <div style="min-width: 100px">Custom</div>
                      <div class="flex-grow-1">
                        <!--                            <v-container fluid>-->

                        <x-btn
                          small
                          btn.class="ma-1 caption"
                          v-for="(col,key) in customTheme"
                          :color="col"
                          :key="key"
                          @click="customKey = key, colorPickerModel= true"
                          tooltip="Click to change the color"
                        > {{ key }}
                        </x-btn>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-item>
              </v-list-item-group>
            </v-list>

          </td>
        </tr>
        </tbody>
      </template>
    </v-simple-table>


    <v-dialog
      v-model="colorPickerModel"
      width="350"
    >
      <v-color-picker class="mx-auto my-2" @input="changeTheme(customTheme)" v-if="customTheme[customKey]"
                      v-model="customTheme[customKey]"></v-color-picker>
    </v-dialog>

  </div>
</template>
<script>

import XIcon from "../../global/xIcon";
import themes from "../../../helpers/themes";
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";

export default {
  components: {DlgLabelSubmitCancel, XIcon},

  data() {
    return {
      rightClickCount: 0,
      tab: null,
      languages: [
        {label: 'English', value: 'en'},
        // {label: 'Japanese', value: 'ja'},
        // {label: 'Chinese', value: 'zh'}
      ],
      item: 'default',
      primary: '',
      colors: [
        '#ea4235',
        '#4CAF50',
        '#FF9800',
        '#0288D1'
      ],
      customKey: null,
      colorPickerModel: false,
      customTheme: {
        "primary": "#6f5dcc",
        "secondary": "#BFDBF7",
        "accent": "#ED254E",
        "info": "#00CED1",
        "success": "#4CAF50",
        "warning": "#FB8C00",
        error: '#ff0100',
      },
      themes: themes
    }
  },
  computed: {
    language: {
      get() {
        return this.$store.state.windows.language;
      }, set(val) {
        this.$store.commit('windows/MutSetLanguage', val);
      }
    },
    showMetatable: {
      get() {
        return this.$store.state.windows.metatables;
      },
      set(show) {
        this.$store.commit('windows/MutMetatables', show)
      }
    },
    showScreensaver: {
      get() {
        return this.$store.state.windows.screensaver;
      },
      set(show) {
        this.$store.commit('windows/MutScreensaver', show)
      }
    }
  },
  methods: {
    rightClick() {
      this.rightClickCount++;
      if (this.rightClickCount > 5) {
        // require('electron').remote.getCurrentWindow().toggleDevTools();
        this.rightClickCount = 0;
      }
    }
    , async changeTheme(t, theme = 'Custom') {
      this.item = theme;
      if (theme === 'Custom')
        await this.$store.dispatch('windows/ActSetTheme', {theme: {...t}, custom: true});
      await this.$store.dispatch('windows/ActSetTheme', {theme: {...t}, themeName: theme});


    },
    toggleDarkTheme() {
      this.$store.commit('windows/MutToggleDarkMode');
    }
  },
  fetch({store, params}) {
  },
  beforeCreated() {
  },
  created() {
    this.customTheme = {...this.customTheme, ...this.$store.state.windows.customTheme}
    this.item = this.$store.state.windows.themeName;
    this.$store.watch(
      state => state.windows.customTheme,
      theme => {
        this.customTheme = {...this.customTheme, ...theme};
      })

    this.$store.watch(state => state.windows.themeName,
      theme => {
        this.$nextTick(() => {
          if (this.item !== theme) this.item = theme
        })
      })
  },
}
</script>

<style scoped>


</style>
<!--
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
-->
