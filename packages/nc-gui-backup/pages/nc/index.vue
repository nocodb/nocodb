<template>
  <v-container fluid class="pa-0 ma-0" style="overflow: auto">
    <!--    <trialExpired v-if="$store.getters['settings/GtrHasTrialPeriodExpired']"></trialExpired>-->
    <splitpanes style="height: calc(100vh - 48px)" class="xc-theme">
      <pane min-size="10" :size="paneSize" max-size="50" style="overflow: auto">
        <ProjectTreeView />
      </pane>
      <pane :size="100 - paneSize">
        <ProjectTabs />

        <!--        <splitpanes horizontal class="xc-theme">-->
        <!--          <pane :size=" mainPanelSize" min-size="50" style="overflow: auto">-->
        <!--            <ProjectTabs/>-->
        <!--          </pane>-->

        <!--          <pane v-if="$store.state.settings.outputWindow" :size="10" style="overflow: auto"  >-->
        <!--            <ProjectOutput   />-->
        <!--          </pane>-->
        <!--          <pane v-if="$store.state.settings.logWindow"  :size="10" style="overflow: auto" >-->
        <!--            <ProjectLogs />-->
        <!--          </pane>-->
        <!--        </splitpanes>-->
      </pane>
    </splitpanes>
  </v-container>
</template>
<script>
import { Splitpanes, Pane } from 'splitpanes';
import ProjectTabs from '~/components/ProjectTabs';
import ProjectTreeView from '@/components/ProjectTreeView';
// import ProjectLogs from "~/components/ProjectLogs";
// import ProjectOutput from "~/components/ProjectOutput";
// import trialExpired from "../../components/trialExpired";
// const {validateInit} = require("electron").remote.require("./libs");
export default {
  components: {
    ProjectTreeView,
    ProjectTabs,
    // ProjectLogs,
    // ProjectOutput,
    Splitpanes,
    Pane,
    // trialExpired

    //   Multipane,
    //   MultipaneResizer
  },
  data() {
    return {
      paneSize: 20,
      mainPanelSize: 80,
    };
  },

  computed: {},
  watch: {},
  async created() {
    // const user = await validateInit();
    // if (user) {
    //   ga('send', 'event', 'init', 'corruption', user);
    // }
    // this.$store.dispatch('users/ActSetUserAbility');
    // this.$store.dispatch('users/ActSetUserAbility');
    this.$store.watch(
      state => state.panelSize.treeView && state.panelSize.treeView.size,
      newSize => {
        this.paneSize = newSize;
      }
    );
    //
    // this.$store.watch(
    //   (state) => !state.settings.outputWindow && !state.settings.logWindow,
    //   (newState) => {
    //     if (newState) this.$nextTick(() => this.mainPanelSize = 100)
    //   }
    // )
  },

  mounted() {},
  methods: {},
};
</script>
<style scoped>
/deep/ .splitpanes__splitter {
  /*background: var(--v-primary-base) !important;*/
  /*border: var(--v-primary-base) !important;*/
  /*opacity: .4;*/
  background: #7f828b33 !important;
  border: #7f828b33 !important;
}
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
