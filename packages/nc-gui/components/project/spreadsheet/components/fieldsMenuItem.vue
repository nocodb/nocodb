<template>
  <div>
    <v-icon v-if="column.pk" color="warning" x-small class="mr-1">mdi-key-variant</v-icon>
    <v-icon v-else-if="uiDatatypeIcon" small class="mr-1">{{ uiDatatypeIcon }}</v-icon>

    <v-icon color="purple" small class="mr-1" v-else-if="isForeignKey">mdi-link-variant</v-icon>

    <span v-else-if="isInt" class="font-weight-bold mr-1" style="font-size: 15px">#</span>
    <!--    <v-icon color="grey" class="mr-1" v-if="isInt">mdi-numeric</v-icon>-->
    <v-icon color="grey" class="mr-1 mt-n1" v-else-if="isFloat">mdi-decimal</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isDate">mdi-calendar</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isDateTime">mdi-calendar-clock</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isSet">mdi-checkbox-multiple-marked</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isEnum">mdi-radiobox-marked</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isBoolean">mdi-check-box-outline</v-icon>
    <v-icon color="grey" class="" v-else-if="isString">mdi-alpha-a</v-icon>
    <v-icon color="grey" small class="mr-1" v-else-if="isTextArea">mdi-card-text-outline</v-icon>
  </div>
</template>

<script>
import cell from "@/components/project/spreadsheet/mixins/cell";

export default {
  name: "fieldsMenuItem",
  mixins: [cell],
  props: {
    sqlUi: [Object, Function],
    column: Object,
  }
}
</script>

<style scoped>

</style>
