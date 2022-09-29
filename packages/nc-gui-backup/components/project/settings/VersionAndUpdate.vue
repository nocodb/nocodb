<template>
  <div>
    <h3 class="text-center mb-5">Version And Update</h3>

    <v-simple-table dense>
      <template #default>
        <tbody>
          <tr>
            <td>Version</td>
            <td>
              <span @contextmenu="rightClick">{{ $store.state.settings.version }}</span>
            </td>
          </tr>
          <!--                <tr>-->
          <!--                  <td>-->
          <!--                    Check for updates-->
          <!--                  </td>-->
          <!--                  <td>-->
          <!--                    <v-switch-->
          <!--                      flat-->
          <!--                      v-model="checkForUpdate"-->
          <!--                      color="grey "-->
          <!--                    ></v-switch>-->
          <!--                  </td>-->
          <!--                </tr>-->
          <tr @dblclick="enableAppRefresh = true">
            <td>Auto update</td>
            <td>
              <v-switch v-model="autoUpdate" flat color="grey " />
            </td>
          </tr>
          <tr v-if="enableAppRefresh">
            <td>Application refresh</td>
            <td>
              <v-btn @click="applicationRefresh"> Refresh </v-btn>
            </td>
          </tr>
        </tbody>
      </template>
    </v-simple-table>

    <dlgLabelSubmitCancel
      v-if="dialogShow"
      :dialog-show="gaDialogShow"
      :actions-mtd="gaDialogFunction"
      heading="Click submit to disable Google Analytics."
      type="primary"
    />

    <dlgLabelSubmitCancel
      v-if="dialogShow"
      :dialog-show="logReportDialogShow"
      :actions-mtd="logReportDialogFunction"
      heading="Error reporting helps us to build a better product. Press cancel to help us build a better product ?"
      type="primary"
    />
  </div>
</template>
<script>
import dlgLabelSubmitCancel from '../../utils/DlgLabelSubmitCancel';

export default {
  components: { dlgLabelSubmitCancel },

  data() {
    return {
      rightClickCount: 0,
      enableAppRefresh: false,
      gaDialogShow: false,
      logReportDialogShow: false,
      languages: [
        { label: 'English', value: 'en' },
        // {label: 'Japanese', value: 'ja'},
        // {label: 'Chinese', value: 'zh'}
      ],
      item: 'default',
    };
  },
  computed: {
    checkForUpdate: {
      get() {
        return this.$store.state.settings.checkForUpdate;
      },
      set(value) {
        this.$store.commit('settings/MutCheckForUpdate', value);
      },
    },
    autoUpdate: {
      get() {
        return this.$store.state.settings.downloadAndUpdateRelease;
      },
      set(value) {
        this.$store.commit('settings/MutDownloadAndUpdateRelease', value);
      },
    },
    isGaEnabled: {
      get() {
        return this.$store.state.settings.isGaEnabled;
      },
      set(value) {
        this.$store.commit('settings/MutToggleGaEnabled', value);
      },
    },
    isErrorReportingEnabled: {
      get() {
        return this.$store.state.settings.isErrorReportingEnabled;
      },
      set(value) {
        this.$store.commit('settings/MutToggleErrorReportingEnabled', value);
      },
    },
    isTelemetryEnabled: {
      get() {
        return this.$store.state.settings.isErrorReportingEnabled;
      },
      set(value) {
        this.$store.commit('settings/MutToggleTelemetryEnabled', value);
      },
    },
    dialogShow: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
    language: {
      get() {
        return this.$store.state.settings.language;
      },
      set(val) {
        this.$store.commit('settings/MutSetLanguage', val);
      },
    },
  },
  methods: {
    rightClick() {
      this.rightClickCount++;
      if (this.rightClickCount > 5) {
        // require('electron').remote.getCurrentWindow().toggleDevTools();
        this.rightClickCount = 0;
      }
    },
    async applicationRefresh() {
      localStorage.removeItem('vuex');
      location.reload();
    },
    toggleGa(event) {
      if (this.isGaEnabled) {
        this.gaDialogShow = true;
      } else {
        this.isGaEnabled = true;
      }
    },
    toggleLogReport(event) {
      if (this.isErrorReportingEnabled) {
        this.logReportDialogShow = true;
      } else {
        this.isErrorReportingEnabled = true;
      }
    },
    logReportDialogFunction(action) {
      if (action !== 'hideDialog' && this.$store.state.users.user && this.$store.state.users.user.email) {
        this.isErrorReportingEnabled = false;
      } else {
        this.$toast
          .error('Only a registered user can disable Error Reporting, Please Login then disable.')
          .goAway(5000);
      }
      this.logReportDialogShow = false;
    },
    gaDialogFunction(action) {
      if (action !== 'hideDialog') {
        if (this.$store.state.users.user && this.$store.state.users.user.email) {
          this.isGaEnabled = false;
        } else {
          this.$toast
            .error('Only a registered user can disable Google Analytics, Please Login then disable.')
            .goAway(5000);
        }
      }
      this.gaDialogShow = false;
    },
  },
};
</script>

<style scoped></style>
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
