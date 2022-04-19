<template>
  <v-dialog
    v-if="show"
    v-model="show"
    align="center"
    absolute
    opacity=".75"
    z-index="9"
    width="max(90%,600px)"
  >
    <!--    :color="$store.state.windows.darkTheme ? 'white' : 'black'"-->
    <!--    :dark="$store.state.windows.darkTheme"-->
    <!--    :light="!$store.state.windows.darkTheme"-->

    <div class="feat-container backgroundColorDefault" style="position: relative; min-height: 500px">
      <!--    <v-card max-height="100%" min-width="95%" max-width="100%" style="overflow: auto">-->
      <!--      <v-card-text>-->

      <table-acl
        v-if="type === 'acl'"
        :nodes="nodes"
      />
      <columns
        v-else-if="type === 'columns'"
        :delete-table="deleteTable"
        :nodes="nodes"
      />
      <indexes
        v-else-if="type === 'indexes'"
        :delete-table="deleteTable"
        :nodes="nodes"
      />
      <triggers
        v-else-if="type === 'triggers'"
        :nodes="nodes"
      />
      <webhooks
        v-else-if="type === 'webhooks'"
        class=""
        :nodes="nodes"
        @close="show=false"
      />
      <validation
        v-else-if="type === 'validators'"
        :nodes="nodes"
      />

      <table-acl
        v-else-if="type === 'view-acl'"
        :nodes="nodes"
      />
      <view-columns
        v-else-if="type === 'view-columns'"
        :nodes="nodes"
      />
      <template
        v-else-if="type === 'shared-views'"
      >
        <shared-views-list
          v-if="show"
          :selected-view="selectedView"
          :model-name="table"
          :nodes="nodes"
          :meta="meta"
        />
      </template>

      <!--      </v-card-text>-->
      <!--    </v-card>-->
    </div>
  </v-dialog>
</template>

<script>
import TableAcl from '@/components/project/tableTabs/tableAcl'
import Columns from '@/components/project/tableTabs/columns'
import Indexes from '@/components/project/tableTabs/indexes'
import Triggers from '@/components/project/tableTabs/triggers'
import Webhooks from '@/components/project/tableTabs/webhooks'
import Validation from '@/components/project/tableTabs/validation'
import ViewColumns from '@/components/project/viewTabs/viewColumns'
import SharedViewsList from '@/components/project/spreadsheet/components/sharedViewsList'

export default {
  name: 'AdditionalFeatures',
  components: { SharedViewsList, ViewColumns, Validation, Webhooks, Triggers, Indexes, Columns, TableAcl },
  props: ['value', 'nodes', 'type', 'deleteTable', 'table', 'selectedView', 'meta'],
  computed: {
    show: {
      set(v) {
        this.$emit('input', v)
      },
      get() {
        return this.value
      }
    }
  }
}
</script>

<style scoped>
/deep/ .v-overlay__content {
  width: 100%;
  /*align-self: flex-start;*/
  /*position: relative;*/
  height: 100%;
  display: flex;
}

.close-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 99999;
}

.feat-container {
  position: relative;
  align-self: center;
  margin:auto !important;
}
</style>
