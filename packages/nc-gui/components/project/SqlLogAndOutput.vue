<template>
  <splitpanes horizontal class="xc-theme">
    <pane :size="mainPanelSize" min-size="50" style="overflow: auto">
      <slot />
    </pane>

    <pane v-if="$store.state.settings.outputWindow && !hide" :size="50" min-size="10" style="overflow: auto">
      <ProjectOutput />
    </pane>
    <!--    <pane v-if="$store.state.settings.logWindow && !$store.state.settings.outputWindow && !hide" :size="10" min-size="10"-->
    <!--          style="overflow: auto">-->
    <!--      <ProjectLogs/>-->
    <!--    </pane>-->
    <!--    <pane v-if="$store.state.settings.logWindow && $store.state.settings.outputWindow && !hide" :size="10" min-size="10"-->
    <!--          style="overflow: auto">-->
    <!--      <ProjectLogs/>-->
    <!--    </pane>-->
  </splitpanes>
</template>

<script>
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
// import ProjectLogs from '~/components/projectLogs'
import ProjectOutput from '~/components/ProjectOutput';

export default {
  name: 'SqlLogAndOutput',
  components: {
    // ProjectLogs,
    ProjectOutput,
    Splitpanes,
    Pane,
  },
  props: {
    hide: Boolean,
  },
  data() {
    return {
      mainPanelSize: 50,
    };
  },
  created() {
    if (!this.$store.state.settings.outputWindow && !this.$store.state.settings.logWindow) {
      this.$nextTick(() => {
        this.mainPanelSize = 100;
      });
    }
    this.$store.watch(
      state => !state.settings.outputWindow && !state.settings.logWindow,
      newState => {
        if (newState) {
          this.$nextTick(() => {
            this.mainPanelSize = 100;
          });
        }
      }
    );
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
