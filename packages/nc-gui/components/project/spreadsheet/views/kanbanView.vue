<template>
  <v-container fluid>
    <kanban-board :stages="kanbanData.stages" :blocks="kanbanData.blocks" @update-block="updateBlock">
      <div v-for="(stage, i) in kanbanData.stages" :slot="stage" :key="stage" class="mx-auto">
        <v-chip :color="kanbanData.stagesColors[i]" class="text-uppercase caption font-weight-bold">
          {{ stage }} 
        </v-chip>
      </div>
      <div v-for="(block, i) in kanbanData.blocks" :slot="block.id" :key="block.id" class="caption">
          <div @click="$emit('expandForm', {
            // TODO
          })">
            {{block}}
            <v-card-text>
              <v-container>
                <v-row class="">
                  <v-col
                    v-for="(col) in fields"
                    v-show="showFields[col.alias|| col._cn]"
                    :key="col.alias || col._cn"
                    class="col-12 mt-1 mb-2 "
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
                    <!-- {{ meta }} -->
                    <!-- {{ col.virtual }} // false  -->
                    <!-- {{ block[col._cn] }} // Coffee Packaging -->
                  </v-col>
                </v-row>
              </v-container>
            </v-card-text>
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
export default {
  name: 'KanbanView',
  components: { TableCell, VirtualCell, HeaderCell, VirtualHeaderCell },
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
    'coverImageField'
  ],
  computed: {
    fields() {
      if (this.availableColumns) {
        return this.availableColumns
      }

      const hideCols = ['created_at', 'updated_at']

      if (this.showSystemFields) {
        return this.meta.columns || []
      } else {
        return this.meta.columns.filter(c => !(c.pk && c.ai) && !hideCols.includes(c.cn) &&
          !((this.meta.v || []).some(v => v.bt && v.bt.cn === c.cn))
        ) || []
      }
    },
    kanbanData() {
      console.log(this.data)
      // stages are distinct values of grouping field
      var stages = []
      var blocks = []
      // TODO: add "Choose a grouping field" window
      const groupingField = "Category"

      for(var i = 0; i < this.data.length; i++) {
        console.log(`this.data[i].row`, this.data[i].row)
        console.log(`this.data[i].rowMeta`, this.data[i].rowMeta)
        
        stages.push(this.data[i].row[groupingField])
        console.log(`this.primaryValueColumn: ${this.primaryValueColumn}`)
        const block = {
          status: this.data[i].row[groupingField],
          ...this.data[i].row
        }
        console.log(block)
        blocks.push(block)
      }
      stages = [...new Set(stages)]
      var stagesColors = ['error', 'primary', 'warning', 'success']
      return {
        stages,
        stagesColors,
        blocks
      }
    }
  },
  methods: {
    updateBlock() {
      // TODO: implement updateBlock func
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {

  ul.drag-list, ul.drag-inner-list {
    list-style-type: none;
    margin: 0;
    padding: 0;
  }

  .drag-container {
    max-width: 1000px;
    margin: 20px auto;
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
    overflow: hidden;
    border-radius: 4px;
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
    padding: 10px;
  }

  .drag-inner-list {
    min-height: 20px;
    //color: white;
  }

  .drag-item {
    padding: 10px;
    margin: 10px;
    //height: 100px;
    background: var(--v-backgroundColor-lighten2);
    transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    border-radius: 4px;
  }

  .drag-item.is-moving {
    transform: scale(1.1);
    background: var(--v-backgroundColor-darken1);
  }

  .drag-header-more {
    cursor: pointer;
  }

  .drag-options {
    position: absolute;
    top: 44px;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 10px;
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

}
</style>
