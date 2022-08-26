<template>
  <div class="backgroundColorDefault d-flex align-center justify-center" :class="{ 'px-3': !isDateTime }">
    <component
      :is="$options.componentMap[filterType]"
      v-model="localState"
      :column="column"
      class="d-flex align-center"
      ignore-focus
    />
  </div>
</template>

<script>
import BooleanType from './BooleanType';
import cell from '~/components/project/spreadsheet/mixins/cell';
import RatingCell from '~/components/project/spreadsheet/components/editableCell/RatingCell';
import EditableUrlCell from '~/components/project/spreadsheet/components/editableCell/EditableUrlCell';
import SetListEditableCell from '~/components/project/spreadsheet/components/editableCell/SetListEditableCell';
import TimePickerCell from '~/components/project/spreadsheet/components/editableCell/TimePickerCell';
import FloatCell from '~/components/project/spreadsheet/components/editableCell/FloatCell';
import IntegerCell from '~/components/project/spreadsheet/components/editableCell/IntegerCell';
import EnumListCell from '~/components/project/spreadsheet/components/editableCell/EnumListEditableCell';
import DateTimePickerCell from '~/components/project/spreadsheet/components/editableCell/DateTimePickerCell';
import TextCell from '~/components/project/spreadsheet/components/editableCell/TextCell';
import DatePickerCell from '~/components/project/spreadsheet/components/editableCell/DatePickerCell';
import DurationCell from '~/components/project/spreadsheet/components/editableCell/DurationCell';

export default {
  name: 'FilterValueInput',
  components: {
    RatingCell,
    EditableUrlCell,
    SetListEditableCell,
    TimePickerCell,
    FloatCell,
    IntegerCell,
    EnumListCell,
    DateTimePickerCell,
    TextCell,
    DatePickerCell,
    DurationCell,
  },
  mixins: [cell],
  props: {
    value: null,
    sqlUi: [Object, Function],
    column: Object,
  },
  componentMap: {
    isRating: RatingCell,
    isDuration: DurationCell,
    isInt: IntegerCell,
    isFloat: FloatCell,
    isDate: DatePickerCell,
    isBoolean: BooleanType,
    isTime: TimePickerCell,
    isDateTime: DateTimePickerCell,
    isEnum: EnumListCell,
    isSet: SetListEditableCell,
    isUrl: EditableUrlCell,
    default: TextCell,
  },
  computed: {
    localState: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      },
    },
    filterType() {
      return Object.keys(this.$options.componentMap).find(key => this[key]) || 'default';
    },
  },
};
</script>

<style scoped></style>
