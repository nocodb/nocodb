<template>
  <text-area-cell v-if="inputDetails.type === 'LongText'" v-model="localState" :input-details="inputDetails" />
  <password-field v-else-if="inputDetails.type === 'Password'" v-model="localState" :input-details="inputDetails" />
  <attachment v-else-if="inputDetails.type === 'Attachment'" v-model="localState" :input-details="inputDetails" />
  <checkbox-field v-else-if="inputDetails.type === 'Checkbox'" v-model="localState" :input-details="inputDetails" />
  <text-field v-else v-model="localState" :input-details="inputDetails" />
</template>

<script>
import TextField from '~/components/project/appStore/inputs/TextField';
import Attachment from '~/components/project/appStore/inputs/Attachment';
import PasswordField from '~/components/project/appStore/inputs/PasswordField';
import TextAreaCell from '~/components/project/spreadsheet/components/editableCell/TextAreaCell';
import CheckboxField from '~/components/project/appStore/inputs/CheckboxField';

export default {
  name: 'FormInput',
  components: { PasswordField, TextAreaCell, Attachment, TextField, CheckboxField },
  props: {
    value: String,
    inputDetails: Object,
  },
  computed: {
    localState: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
  },
};
</script>

<style scoped></style>
