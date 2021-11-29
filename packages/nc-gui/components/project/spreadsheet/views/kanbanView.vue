<template>
  <v-container fluid>
    <kanban-board :stages="stages" :blocks="clonedBlocks" @update-block="updateBlock">
      <div v-for="stage in stages" :slot="stage" :key="stage" class="mx-auto">
        <enum-cell :value="stage" :column="groupingFieldColumn" />
      </div>
      <div v-for="(block, i) in clonedBlocks" :slot="block.id" :key="block.id" class="caption">
          <v-hover v-slot="{hover}">
            <v-card
              class="h-100"
              :elevation="hover ? 4 : 1"
              @click="$emit('expandForm', {row: block, rowIndex: i, rowMeta: block.rowMeta})"
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
    'data',
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
    }
  },
  async mounted() {
    await this.setKanbanData()
  },
  watch: {
    async groupingField(newVal) {
      this.groupingField = newVal
      this.reset()
      await this.setKanbanData()
    },
    async data(newVal) {
      this.data = newVal
      this.reset()
      await this.setKanbanData()
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
      return this.fields.filter(o => o.alias == this.groupingField)[0]
    }
  },
  methods: {
    async setKanbanData() {
      const uncategorized = "Uncategorized"
      try {
        this.stages.push(uncategorized)
        for(var i = 0; i < this.data.length; i++) {
          const status = this.data[i].row[this.groupingField] ?? uncategorized
          this.stages.push(status)
          const block = {
            status,
            rowMeta: this.data[i].rowMeta,
            ...this.data[i].row
          }
          // console.log(block)
          this.blocks.push(block)
        }
        this.stages = [...new Set(this.stages)]
        this.clonedBlocks = this.blocks
        return Promise.resolve(this.blocks)
      } catch(e) {
        return Promise.reject(e)
      }
    },
    async updateBlock(id, status) {
      try {
        if(!this.api) {
          return
        }

        if(this.blocks[id - 1].status == status) {
          // no change
          return
        }

        const uncategorized = "Uncategorized"

        const prevStatus = this.blocks[id - 1].status
        const newData = await this.api.update(id, 
        { [this.groupingField]: status == uncategorized ? null : status }, // new data
        { [this.groupingField]: prevStatus }) // old data

        this.blocks[id - 1].status = status
        this.blocks[id - 1][this.groupingField] = (status == uncategorized ? null : status)

        this.$toast.success(`Moved block from ${prevStatus} to ${status ?? uncategorized} successfully.`, {
          position: 'bottom-center'
        }).goAway(3000)

      } catch (e) {
        if (e.response && e.response.data && e.response.data.msg) {
          this.$toast.error(e.response.data.msg).goAway(3000)
        } else {
          this.$toast.error(`Failed to update block : ${e.message}`).goAway(3000)
        }
      }
    },
    reset() {
      this.stages = []
      this.stageColors = []
      this.blocks = []
      this.clonedBlocks = []    
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
    max-height: 500px;
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
    padding: 10px 10px 0px 10px;
    width: 240px;
  }

  .drag-inner-list {
    min-height: 20px;
    //color: white;
  }

  .drag-item {
    // padding: 10px;
    margin: 10px;
    //height: 100px;
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
