<template>
  <div>
    <v-icon v-if="column.pk" color="warning" x-small class="mr-1">
      mdi-key-variant
    </v-icon>
    <v-icon v-else-if="uiDatatypeIcon" small class="mr-1">
      {{ uiDatatypeIcon }}
    </v-icon>

    <v-icon v-else-if="isForeignKey" color="purple" small class="mr-1">
      mdi-link-variant
    </v-icon>

    <span v-else-if="isInt" class="font-weight-bold mr-1" style="font-size: 15px">#</span>
    <v-icon v-else-if="isFloat" color="grey" class="mr-1 mt-n1">
      mdi-decimal
    </v-icon>
    <v-icon v-else-if="isDate" color="grey" small class="mr-1">
      mdi-calendar
    </v-icon>
    <v-icon v-else-if="isDateTime" color="grey" small class="mr-1">
      mdi-calendar-clock
    </v-icon>
    <v-icon v-else-if="isSet" color="grey" small class="mr-1">
      mdi-checkbox-multiple-marked
    </v-icon>
    <v-icon v-else-if="isEnum" color="grey" small class="mr-1">
      mdi-radiobox-marked
    </v-icon>
    <v-icon v-else-if="isBoolean" color="grey" small class="mr-1">
      mdi-check-box-outline
    </v-icon>
    <v-icon v-else-if="isString" color="grey" class="">
      mdi-alpha-a
    </v-icon>
    <v-icon v-else-if="isTextArea" color="grey" small class="mr-1">
      mdi-card-text-outline
    </v-icon>
  </div>
</template>

<script>
import cell from '@/components/project/spreadsheet/mixins/cell'

export default {
  name: 'FieldsMenuItem',
  mixins: [cell],
  props: {
    sqlUi: [Object, Function],
    column: Object
  }
}
</script>

<style scoped>

</style>
