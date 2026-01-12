<script lang="ts" setup>
const initState = ref({
  someDefaultProp: 'value',
})

const { formState, isLoading, submit } = useProvideFormBuilderHelper({
  formSchema: [
    {
      type: FormBuilderInputType.Input,
      label: 'Sample Input',
      span: 24,
      model: 'title',
      placeholder: 'Some placeholder',
      category: 'General',
      required: true,
    },
    {
      type: FormBuilderInputType.Input,
      label: 'Input To Nested Path',
      span: 12,
      model: 'config.sample',
      placeholder: 'This is added to config.sample',
      category: 'Sample Category',
      helpText: 'This is a sample help text',
      required: true,
    },
    {
      type: FormBuilderInputType.Input,
      label: 'Multiple Elements in Category',
      span: 12,
      model: 'config.sample2',
      placeholder: 'This is added to config.sample2',
      category: 'Sample Category',
      required: false,
    },
    {
      type: FormBuilderInputType.Select,
      label: 'Sample Select',
      span: 24,
      model: 'config.select',
      category: 'Settings',
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' },
      ],
      defaultValue: 'option2',
      required: true,
    },
    {
      type: FormBuilderInputType.Switch,
      label: 'Sample Switch',
      span: 24,
      model: 'config.switch',
      category: 'Misc',
      helpText: 'This is a sample switch',
      required: false,
      border: true,
    },
  ],
  onSubmit: async () => {
    console.log('submit', formState)
  },
  initialState: initState,
})
</script>

<template>
  <div class="h-full">
    <NcFormBuilder />
    <div class="mt-10"></div>
    <NcButton :loading="isLoading" type="primary" @click="submit">Submit</NcButton>
  </div>
</template>

<style lang="scss" scoped></style>
