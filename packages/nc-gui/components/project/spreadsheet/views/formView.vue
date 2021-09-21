<template>
  <v-container fluid class="h-100">
    <v-row class="h-100">
      <v-col cols="4">
        <v-card class="h-100 pa-2" outlined>
          <draggable
            v-model="hiddenColumns"
            draggable=".item"
            group="form-inputs"
            class="h-100"
            @start="drag=true"
            @end="drag=false"
          >
            <v-card
              v-for="(col) in hiddenColumns"
              :key="col.alias"
              outlined
              class="pa-2 my-2 item"
            >
              {{ col.alias }}
            </v-card>
          </draggable>
        </v-card>
      </v-col>
      <v-col class="h-100 px-10" style="overflow-y: auto" cols="8">
        <draggable
          v-model="columns"
          draggable=".item"
          group="form-inputs"
          class="h-100"
          @start="drag=true"
          @end="drag=false"
        >
          <v-card
            v-for="(col,i) in columns"
            :key="col.alias"
            outlined
            class="pa-2 my-2 item"
          >
            <v-overlay absolute />
            <div
              v-if="!col.lk"
              :key="i"
              :class="{
                'active-row' : active === col._cn
              }"
              class="row-col  my-4"
            >
              <div>
                <label :for="`data-table-form-${col._cn}`" class="body-2 text-capitalize">
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
                    :sql-ui="sqlUi"
                  />

                </label>
                <virtual-cell
                  v-if="col.virtual"
                  ref="virtual"
                  :column="col"
                  :row="localState"
                  :nodes="nodes"
                  :meta="meta"
                  :api="api"
                  :active="true"
                  :sql-ui="sqlUi"
                  :is-form="true"
                />
                <editable-cell
                  v-else
                  :id="`data-table-form-${col._cn}`"
                  v-model="localState[col._cn]"
                  :db-alias="dbAlias"
                  :column="col"
                  class="xc-input body-2"
                  :meta="meta"
                  :sql-ui="sqlUi"
                  is-form
                  @focus="active = col._cn"
                  @blur="active = ''"
                />
              </div>
            </div>
          </v-card>
        </draggable>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

import draggable from 'vuedraggable'
import VirtualHeaderCell from '../components/virtualHeaderCell'
import HeaderCell from '../components/headerCell'
import VirtualCell from '../components/virtualCell'
import EditableCell from '../components/editableCell'

export default {
  name: 'FormView',
  components: { EditableCell, VirtualCell, HeaderCell, VirtualHeaderCell, draggable },
  props: ['meta', 'availableColumns', 'nodes', 'sqlUi', 'formParams'],
  data: () => ({ localState: {}, columns: [], hiddenColumns: [] }),
  computed: {},
  mounted() {
    this.columns = [...this.availableColumns]
  }
}
</script>

<style scoped lang="scss">
</style>
