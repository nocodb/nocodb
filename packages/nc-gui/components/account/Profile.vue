<script lang="ts" setup>
const { user } = useGlobal()

const isErrored = ref(false)
const isTitleUpdating = ref(false)
const form = ref({
  title: '',
  email: '',
})

const { updateUserProfile } = useUsers()
const formValidator = ref()

const formRules = {
  title: [
    { required: true, message: 'Name required' },
    { min: 2, message: 'Name must be at least 2 characters long' },
    { max: 60, message: 'Name must be at most 60 characters long' },
  ],
}

const onSubmit = async () => {
  const valid = await formValidator.value.validate()

  if (!valid) return

  if (isTitleUpdating.value) return

  isTitleUpdating.value = true
  isErrored.value = false

  try {
    await updateUserProfile({ attrs: { display_name: form.value.title } })
  } catch (e: any) {
    console.error(e)
  } finally {
    isTitleUpdating.value = false
  }
}

const email = computed(() => user.value?.email)

watch(
  () => user.value?.display_name,
  () => {
    if (!user.value?.display_name) return

    form.value.title = user.value.display_name
    form.value.email = user.value.email
  },
  {
    immediate: true,
  },
)

const onValidate = async (_: any, valid: boolean) => {
  isErrored.value = !valid
}
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="flex flex-col w-150">
      <div class="flex font-medium text-xl">Profile</div>
      <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
        <div class="flex font-medium text-base">Account details</div>
        <div class="flex text-gray-500">Control your appearance.</div>
        <div class="flex flex-row mt-4">
          <div class="flex h-20 mt-1.5">
            <GeneralUserIcon size="xlarge" />
          </div>
          <div class="flex w-10"></div>
          <a-form
            ref="formValidator"
            layout="vertical"
            no-style
            :model="form"
            class="flex flex-col w-full"
            @finish="onSubmit"
            @validate="onValidate"
          >
            <div class="text-gray-800 mb-1.5">Name</div>
            <a-form-item name="title" :rules="formRules.title">
              <a-input
                v-model:value="form.title"
                class="w-full !rounded-md !py-1.5"
                placeholder="Name"
                data-testid="nc-account-settings-rename-input"
              />
            </a-form-item>
            <div class="text-gray-800 mb-1.5">Account Email ID</div>
            <a-input
              v-model:value="email"
              class="w-full !rounded-md !py-1.5"
              placeholder="Email"
              disabled
              data-testid="nc-account-settings-email-input"
            />
            <div class="flex flex-row w-full justify-end mt-8">
              <NcButton
                type="primary"
                html-type="submit"
                :disabled="isErrored || (form.title && form.title === user?.display_name)"
                :loading="isTitleUpdating"
                data-testid="nc-account-settings-save"
                @click="onSubmit"
              >
                <template #loading> Saving </template>
                Save
              </NcButton>
            </div>
          </a-form>
        </div>
      </div>
    </div>
  </div>
</template>
