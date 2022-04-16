<template>
  <v-container fluid class="pa-0 ma-0" style="overflow: auto">
    <splitpanes class="xc-theme nc-dashboard">
      <pane
        :min-size="treeViewMinSize"
        :size="treeViewSize"
        :max-size="treeViewMaxSize"
        style="position: relative;overflow-x: hidden"
      >
        <ProjectTreeView v-show="enableTree" ref="treeview" />
        <v-btn
          x-small
          icon
          color="grey"
          class="pane-toggle"
          :class="{'pane-toggle-active': enableTree}"
          @click="toggleTreeView"
        >
          <v-icon x-small color="rgba(127,130,139)">
            {{ enableTree ? 'mdi-arrow-left' : 'mdi-arrow-right' }}
          </v-icon>
        </v-btn>
      </pane>
      <pane :size="projectTabsSize">
        <ProjectTabs :key="pid" @tableCreate="tableCreate" />
      </pane>
    </splitpanes>
  </v-container>
</template>
<script>

import { Splitpanes, Pane } from 'splitpanes'
import ProjectTabs from '@/components/projectTabs'
import ProjectTreeView from '@/components/ProjectTreeView'

export default {
  components: {
    ProjectTreeView,
    ProjectTabs,
    Splitpanes,
    Pane
  },
  data() {
    return {
      paneSize: 18,
      mainPanelSize: 82,
      enableTree: true
    }
  },
  computed: {
    pid() {
      return this.$route.params.project_id
    },
    treeViewMinSize() {
      return this.enableTree ? 10 : 1.5
    },
    treeViewMaxSize() {
      return this.enableTree ? 50 : 1.5
    },
    treeViewSize() {
      return this.enableTree ? this.paneSize : 1.5
    },
    projectTabsSize() {
      return this.enableTree ? 100 - this.paneSize : 100
    }
  },
  async created() {
    this.$store.watch(
      state => state.panelSize.treeView && state.panelSize.treeView.size,
      (newSize) => { this.paneSize = newSize }
    )
  },
  mounted() {
    if ('new' in this.$route.query) {
      this.simpleAnim()
      this.$router.replace({ query: {} })
    }
    try {
      // eslint-disable-next-line no-undef
      hj('stateChange', `${this.$axios.defaults.baseURL}/dashboard/#/nc/`)
    } catch (e) {
    }
  },
  methods: {
    tableCreate(table) {
      if (this.$refs.treeview) {
        this.$refs.treeview.mtdTableCreate(table)
      }
    },
    simpleAnim() {
      const count = 200
      const defaults = {
        origin: { y: 0.7 }
      }

      function fire(particleRatio, opts) {
        window.confetti(Object.assign({}, defaults, opts, {
          particleCount: Math.floor(count * particleRatio)
        }))
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55
      })
      fire(0.2, {
        spread: 60
      })
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 45
      })
    },
    toggleTreeView() {
      this.enableTree = !this.enableTree
    }
  }
}
</script>
<style scoped>
.xc-theme{
  height:calc(100vh - 48px);
  position: relative;
}

/deep/ .splitpanes__splitter {
  background: #7f828b33 !important;
  border: #7f828b33 !important;
}
/deep/ .nc-dashboard > .splitpanes__splitter {
  margin-top: 30px;
  position: relative;
}
/deep/ .nc-dashboard > .splitpanes__splitter::before {
  height: 30px;
  content: '';
  position: absolute;
  top:-30px;
  left: 0;
  width: 100%;
  background: var(--v-primary-base);
}
.pane-toggle {
  position: absolute;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
  right:-8px;
  top: 50%;
  bottom: 50%;
  z-index: 2;
}

.theme--light .pane-toggle {
  background-color: var(--v-backgroundColor-base);
  border: 2px solid rgba(0, 0, 0, 0.12);
}

.theme--dark .pane-toggle {
  background-color: var(--v-backgroundColor-base);
}
</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 * @author Liel Fridman <lielft@gmail.com>
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
