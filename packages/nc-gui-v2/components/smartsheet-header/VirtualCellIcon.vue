<script setup lang="ts">
import { LinkToAnotherRecordType, RelationTypes, UITypes } from "nocodb-sdk";
import { ColumnInj } from '~/components'
import GenericIcon from '~icons/mdi/square-rounded'
import HMIcon from '~icons/mdi/table-arrow-right'
import BTIcon from '~icons/mdi/table-arrow-left'
import MMIcon from '~icons/mdi/table-network'
import FormulaIcon from '~icons/mdi/math-integral'
import RollupIcon from '~icons/mdi/movie-roll'

const column = inject(ColumnInj)

const icon = computed(() => {
  switch (column?.uidt) {
    case UITypes.LinkToAnotherRecord:
      switch ((<LinkToAnotherRecordType>column?.colOptions)?.type) {
        case RelationTypes.MANY_TO_MANY:
          return MMIcon
        case RelationTypes.HAS_MANY:
          return HMIcon
        case RelationTypes.BELONGS_TO:
          return BTIcon
      }
      break
    case UITypes.Formula:
      return FormulaIcon
    case UITypes.Lookup:
      return GenericIcon
    case UITypes.Rollup:
      return RollupIcon
  }
  return GenericIcon
})

/*
*
        <v-icon v-else-if="type === 'formula'" x-small class="mr-1" v-on="on">
          mdi-math-integral
        </v-icon>
        <template v-else-if="type === 'lk'">
          <v-icon v-if="relationType === 'hm'" color="warning" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
          <v-icon v-else-if="relationType === 'bt'" color="info" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
          <v-icon v-else-if="relationType === 'mm'" color="pink" x-small class="mr-1" v-on="on">
            mdi-table-column-plus-before
          </v-icon>
        </template>
        <template v-else-if="type === 'rl'">
          <v-icon v-if="relationType === 'hm'" color="warning" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
          <v-icon v-else-if="relationType === 'bt'" color="info" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
          <v-icon v-else-if="relationType === 'mm'" color="pink" x-small class="mr-1" v-on="on">
            {{ rollupIcon }}
          </v-icon>
        </template>
* */
</script>

<template>
  <component :is="icon" class="text-grey mx-1" />
</template>
