<template>
  <v-container fluid class="h-100 d-100" style="overflow:auto ">
    <kanban-board
      :stages="kanban.groupingColumnItems"
      :blocks="kanban.blocks"
      class="h-100 my-0 mx-n2"
      @update-block="updateBlock"
    >
      <div v-for="stage in kanban.groupingColumnItems" :slot="stage" :key="stage" class="mx-auto">
        <enum-cell :value="stage" :column="groupingFieldColumn" />
      </div>
      <div v-for="(block) in kanban.blocks" :slot="block.id" :key="block.c_pk" class="caption">
        <v-hover v-slot="{hover}">
          <v-card
            class="h-100"
            :elevation="hover ? 4 : 1"
            @click="$emit('expandKanbanForm', {rowIdx: block.c_pk})"
          >
            <v-card-text>
              <v-container>
                <v-row class="">
                  <v-col
                    v-for="(col) in fields"
                    v-show="showFields[col.alias|| col.title]"
                    :key="col.alias || col.title"
                    class="kanban-col col-12"
                  >
                    <label :for="`data-table-form-${col.title}`" class="body-2 text-capitalize caption grey--text">
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
                        :value="col.title"
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
                      :value="block[col.title]"
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
      <div v-for="stage in kanban.groupingColumnItems" :key="stage" :slot="`footer-${stage}`" class="kanban-footer">
        <x-btn
          v-if="stage"
          outlined
          tooltip="Add a new record"
          color="primary"
          class="primary"
          x-small
          fab
          @click="insertNewRow(true, true, {[groupingField]: stage})"
        >
          <v-icon small>
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
        <div class="record-cnt caption grey--text">
          {{ kanban.recordCnt[stage] }} / {{ kanban.recordTotalCnt[stage] }}
          {{ kanban.recordTotalCnt[stage] > 1 ? "records" : "record" }}
        </div>
      </div>
    </kanban-board>
  </v-container>
</template>

<script>
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
    'api'
  ],
  computed: {
    fields() {
      if (this.availableColumns) {
        return this.availableColumns
      }
      if (this.showSystemFields) {
        return this.meta.columns || []
      }
      const hideCols = ['created_at', 'updated_at']
      return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.column_name) &&
        !((this.meta.v || []).some(v => v.bt && v.bt.column_name === c.column_name))
      ) || []
    },
    groupingFieldColumn() {
      return this.fields.filter(o => o.alias === this.groupingField)[0]
    }
  },
  mounted() {
    const kbListElements = document.querySelectorAll('.drag-inner-list')
    kbListElements.forEach((kbListEle) => {
      kbListEle.addEventListener('scroll', async(e) => {
        if (kbListEle.scrollTop + kbListEle.clientHeight >= kbListEle.scrollHeight) {
          const groupingFieldVal = kbListEle.getAttribute('data-status')
          this.$emit('loadMoreKanbanData', groupingFieldVal)
        }
      })
    })
  },
  methods: {
    async updateBlock(c_pk, status) {
      try {
        if (!this.api) {
          this.$toast.error('API not found', {
            position: 'bottom-center'
          }).goAway(3000)
          return
        }

        // update kanban block
        const targetBlock = this.kanban.blocks.find(b => b.c_pk === c_pk)
        if (!targetBlock) {
          this.$toast.error(`Block with ID ${c_pk} not found`, {
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
        await this.api.update(c_pk,
          { [this.groupingField]: status === uncategorized ? null : status }, // new data
          { [this.groupingField]: prevStatus }) // old data

        this.$set(targetBlock, 'status', status)
        this.$set(targetBlock, this.groupingField, status === uncategorized ? null : status)

        // update kanban data
        const kanbanRow = this.kanban.data.find(d => d.row.c_pk === c_pk)
        if (kanbanRow) {
          this.$set(kanbanRow.row, this.groupingField, status === uncategorized ? null : status)
        }
        this.$set(this.kanban.recordCnt, prevStatus, this.kanban.recordCnt[prevStatus] - 1)
        this.$set(this.kanban.recordCnt, status, this.kanban.recordCnt[status] + 1)
        this.$set(this.kanban.recordTotalCnt, prevStatus, this.kanban.recordTotalCnt[prevStatus] - 1)
        this.$set(this.kanban.recordTotalCnt, status, this.kanban.recordTotalCnt[status] + 1)
        this.$forceUpdate()
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
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .v-card {
    border: 1px solid rgba(0, 0, 0, 0.2);
  }

  ul.drag-inner-list {
    overflow-y: scroll;
  }

  ul.drag-list, ul.drag-inner-list {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }

  .drag-container {
    //max-width: 1000px;
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

/*  .drag-column-footer .v-btn {
    border-radius: 50%;
    border: 2px solid;
    padding: 0px 0px 0px 6px;
    min-width: 40px;
    min-height: 38px;
  }*/

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

  .kanban-col {
    padding: 10px;
  }

  .drag-container {
    display: inline-block;
    .drag-list {
      height: 100%;
      display: inline-flex;

      .drag-column {
        display: flex;
        flex-direction: column;
        max-height: max(400px,100%);

        .drag-inner-list {
          overflow-y: auto;
          overflow-x: hidden;
          min-height: 200px;
          flex-grow: 1
        }
      }
    }
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
