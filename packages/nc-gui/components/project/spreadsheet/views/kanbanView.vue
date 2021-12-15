<template>
  <v-container fluid>
    <v-row>
      <v-col v-for="idx in 5" :key="idx">
        <v-skeleton-loader v-if="loadingData" type="image@3"></v-skeleton-loader>
      </v-col>
    </v-row>
    <kanban-board v-show="!loadingData" :stages="stages" :blocks="clonedBlocks" @update-block="updateBlock">
      <div v-for="stage in stages" :slot="stage" :key="stage" class="mx-auto">
        <enum-cell :value="stage" :column="groupingFieldColumn" />
      </div>
      <div v-for="(block) in clonedBlocks" :slot="block.id" :key="block.id" class="caption">
          <v-hover v-slot="{hover}">
            <v-card
              class="h-100"
              :elevation="hover ? 4 : 1"
              @click="$emit('expandKanbanForm', {rowIdx: block.id})"
            >
              <v-card-text>
                <v-container>
                  <v-row class="">
                    <v-col
                      v-for="(col) in fields"
                      v-show="showFields[col.alias|| col._cn]"
                      :key="col.alias || col._cn"
                      class="kanban-col col-12"
                    >
                      <label :for="`data-table-form-${col._cn}`" class="body-2 text-capitalize caption grey--text">
                        <virtual-header-cell
                          v-if="col.virtual"
                          :column="col"
                          :nodes="nodes"
                          :is-form="true"
                          :meta="meta"
                        />
                        <header-cell
                          v-else
                          :is-form="true"
                          :value="col._cn"
                          :column="col"
                        />
                      </label>
                      <virtual-cell
                        v-if="col.virtual"
                        ref="virtual"
                        :column="col"
                        :row="block"
                        :nodes="nodes"
                        :meta="meta"
                      />
                      <table-cell
                        v-else
                        :value="block[col._cn]"
                        :column="col"
                        :sql-ui="sqlUi"
                        class="xc-input body-2"
                        :meta="meta"
                      />
                    </v-col>
                  </v-row>
                </v-container>
              </v-card-text>
            </v-card>
          </v-hover>
      </div>
      <div v-for="stage in stages" :key="stage" :slot="`footer-${stage}`" class="kanban-footer">
          <x-btn
          v-if="stage"
          outlined
          tooltip="Add a new record"
          color="primary"
          class="primary"
          small
          @click="insertNewRow(true, true, {[groupingField]: stage})"
        >
          <v-icon small left>
            mdi-plus
          </v-icon>
        </x-btn>
        <!-- <x-btn
          v-else
          outlined
          tooltip="New Stack"
          color="primary"
          class="primary"
          small
          @click="insertNewRow(true, true, {[groupingField]: stage})"
        >
          <v-icon small left>
            mdi-plus
          </v-icon>
            New Stack
        </x-btn> -->

        <div class="record-cnt">
          {{ kanban.recordCnt[stage] }} {{ kanban.recordCnt[stage] > 1 ? "records" : "record" }}
        </div>
      </div>
    </kanban-board>
  </v-container>
</template>

<script>

// import "vue-kanban/src/assets/kanban.css";
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import TableCell from '../components/cell'
import EnumCell from '../components/cell/enumCell'
export default {
  name: 'KanbanView',
  components: { TableCell, VirtualCell, HeaderCell, VirtualHeaderCell, EnumCell },
  props: [
    'nodes',
    'table',
    'showFields',
    'availableColumns',
    'meta',
    'kanban',
    'primaryValueColumn',
    'showSystemFields',
    'sqlUi',
    'groupingField',
    'api',
  ],
  data() {
    return {
      stages: [],
      stageColors: [],
      blocks: [],
      clonedBlocks: [],
      loadingData: true,
    }
  },
  async mounted() {
    await this.setKanbanData()
  },
  watch: {
    'kanban.data': {
      async handler() {
        await this.setKanbanData()
      },
      deep: true
    }
  },
  computed: {
    fields() {
      if (this.availableColumns) {
        return this.availableColumns
      }
      if (this.showSystemFields) {
        return this.meta.columns || []
      }
      const hideCols = ['created_at', 'updated_at']
      return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn) &&
        !((this.meta.v || []).some(v => v.bt && v.bt.cn === c.cn))
      ) || []
    },
    groupingFieldColumn() {
      return this.fields.filter(o => o.alias === this.groupingField)[0]
    }
  },
  methods: {
    async setKanbanData() {
      const uncategorized = 'Uncategorized'
      try {
        this.loadingData = true
        this.reset()

        const n = this.kanban.data.length
        for (let i = 0; i < n; i++) {
          if (!this.kanban.data[i].row.id) {
            // skip empty record
            // case: add a new record -> cancel -> empty row -> no id
            continue
          }
          const status = this.kanban.data[i].row[this.groupingField] ?? uncategorized
          const block = {
            status,
            ...this.kanban.data[i].row
          }
          this.kanban.recordCnt[status] += 1
          this.blocks.push(block)
        }
        
        this.stages = this.kanban.groupingColumnItems

        // new stack column
        // this.stages.push("")
        this.clonedBlocks = this.blocks
        return Promise.resolve(this.clonedBlocks)
      } catch (e) {
        return Promise.reject(e)
      } finally {
        this.loadingData = false
      }
    },
    async updateBlock(id, status) {
      try {
        if (!this.api) {
          this.$toast.error('API not found', {
            position: 'bottom-center'
          }).goAway(3000)
          return
        }

        const targetBlock = this.clonedBlocks.find(b => b.id === Number(id))
        if (!targetBlock) {
          this.$toast.error(`Block with ID ${id} not found`, {
            position: 'bottom-center'
          }).goAway(3000)
          return
        }

        if (targetBlock.status === status) {
          // no change
          return
        }

        const uncategorized = 'Uncategorized'
        const prevStatus = targetBlock.status
        await this.api.update(id,
          { [this.groupingField]: status === uncategorized ? null : status }, // new data
          { [this.groupingField]: prevStatus }) // old data


        const targetBlockIdx = this.clonedBlocks.findIndex(b => b.id === Number(id))
        // this.clonedBlocks[targetBlockIdx].status = status
        // this.clonedBlocks[targetBlockIdx][this.kanbanGroupingField] = (status === uncategorized ? null : status)
        this.$emit('updateKanbanBlock')
        this.$toast.success(`Moved block from ${prevStatus} to ${status ?? uncategorized} successfully.`, {
          position: 'bottom-center'
        }).goAway(3000)
      } catch (e) {
        if (e.response && e.response.data && e.response.data.msg) {
          this.$toast.error(e.response.data.msg, {
            position: 'bottom-center'
          }).goAway(3000)
        } else {
          this.$toast.error(`Failed to update block : ${e.message}`, {
            position: 'bottom-center'
          }).goAway(3000)
        }
      }
    },
    insertNewRow(atEnd = false, expand = false, presetValues = {}) {
      this.$emit('insertNewRow', atEnd, expand, presetValues)
    },
    reset() {
      this.stages = []
      this.blocks = []
      this.clonedBlocks = []
    },
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-card {
    border: 1px solid rgba(0, 0, 0, 0.2);
  }

  ul.drag-inner-list {
    height: 400px;
    overflow-y: scroll;
  }

  ul.drag-list, ul.drag-inner-list {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }

  .drag-container {
    max-width: 1000px;
    margin: 20px 0px;
  }

  .drag-list {
    display: flex;
    align-items: flex-start;
  }

  @media (max-width: 690px) {
    .drag-list {
      display: block;
    }
  }

  .drag-column {
    flex: 1;
    margin: 0 10px;
    position: relative;
    background: var(--v-backgroundColor-base); //rgba(256, 256, 256, 0.2);
    border-radius: 6px;
    max-width: 240px;
  }

  .drag-column-footer {
    padding: 20px 10px 10px 10px;
    text-align: center;
  }

  .drag-column-footer .v-btn {
    border-radius: 50%;
    border: 2px solid;
    padding: 0px 0px 0px 6px;
    min-width: 40px;
    min-height: 38px;
  }

  .drag-column-footer .record-cnt {
    height: 38px;
    line-height: 38px;
    font-size: 15px;
  }

  .drag-column-footer .v-btn .mdi-plug::before {
    font-weight: bold;
  }

  @media (max-width: 690px) {
    .drag-column {
      margin-bottom: 30px;
    }
  }

  .drag-column h2 {
    font-size: 0.8rem;
    margin: 0;
    text-transform: uppercase;
    font-weight: 600;
  }

  .drag-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 240px;
  }

  .drag-column-header .set-item {
    margin-top: 20px !important;
  }

  .drag-item {
    margin: 10px;
    background: var(--v-backgroundColor-lighten2);
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    border-radius: 4px;
  }

  .drag-item .container {
    padding: 0px;
  }

  .drag-item.is-moving {
    transform: scale(1.1);
    background: var(--v-backgroundColor-darken1);
  }

  .drag-header-more {
    cursor: pointer;
  }

  .drag-options {
    left: 0;
    width: 100%;
    height: 100%;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .drag-options.active {
    transform: translateX(0);
    opacity: 1;
  }

  .drag-options-label {
    display: block;
    margin: 0 0 5px 0;
  }

  .drag-options-label input {
    opacity: 0.6;
  }

  .drag-options-label span {
    display: inline-block;
    font-size: 0.9rem;
    font-weight: 400;
    margin-left: 5px;
  }

  /* Dragula CSS  */
  .gu-mirror {
    position: fixed !important;
    margin: 0 !important;
    z-index: 9999 !important;
    opacity: 0.8;
    list-style-type: none;
  }

  .gu-hide {
    display: none !important;
  }

  .gu-unselectable {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
  }

  .gu-transit {
    opacity: 0.2;
  }

  .kanban-col  {
    padding: 10px;
  }

}
</style>


<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
