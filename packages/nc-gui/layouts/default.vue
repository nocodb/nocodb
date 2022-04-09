<template>
  <v-app v-if="isProjectInfoLoaded">
    <snackbar />
    <v-app-bar
      class="elevation-0"
      color="primary"
      app
      clipped-left
      dense
      dark
      height="48"
    >
      <main-header />
    </v-app-bar>

    <v-main class="pb-0 mb-0">
      <v-container class="ma-0 pa-0" fluid style="">
        <v-progress-linear
          v-show="GetPendingStatus"
          top
          absolute
          color="success"
          indeterminate
          height="2"
        />
        <nuxt />
      </v-container>
    </v-main>
    <loader />
  </v-app>
  <v-app v-else>
    <v-overlay>
      <v-progress-circular indeterminate size="64" />
    </v-overlay>
  </v-app>
</template>

<script>
import { mapGetters } from 'vuex'
import 'splitpanes/dist/splitpanes.css'
import Snackbar from '~/components/snackbar'
import Loader from '~/components/loader'
import MainHeader from '~/components/layout/mainHeader'

export default {
  components: {
    MainHeader,
    Loader,
    Snackbar
  },
  data: () => ({
    error: null,
    dialogErrorShow: false,
    dialogDebug: false,
    shareModal: false
  }),
  computed: {
    ...mapGetters({
      GetPendingStatus: 'notification/GetPendingStatus'
    })
  },
  methods: {
    isProjectInfoLoaded() {
      return this.$store.state.project.projectInfo !== null
    },
    errorDialogCancel() {
      this.dialogErrorShow = false
    },
    errorDialogReport() {
      this.dialogErrorShow = false
    },
    dialogDebugCancel() {
      this.dialogDebug = false
    }
  }

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
