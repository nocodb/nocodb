<script lang="ts" setup>
const { currentUser } = storeToRefs(useUsers())

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

const email = computed(() => currentUser.value?.email)

watch(
  () => currentUser.value?.display_name,
  () => {
    if (!currentUser.value?.display_name) return

    form.value.title = currentUser.value.display_name
    form.value.email = currentUser.value.email
  },
  {
    immediate: true,
  },
)

watch(
  () => form.value.title,
  async () => {
    try {
      isErrored.value = !(await formValidator.value.validate())
    } catch (e: any) {
      isErrored.value = true
    }
  },
)
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="flex flex-col w-150">
      <div class="flex font-medium text-xl">Profile</div>
      <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
        <div class="flex font-medium text-base">Account details</div>
        <div class="flex text-gray-500">Control your appearance.</div>
        <div class="flex flex-row mt-4 gap-x-8">
          <div class="flex h-20 mt-1.5">
            <GeneralUserIcon size="xlarge" />
          </div>
          <a-form ref="formValidator" layout="vertical" no-style :model="form" class="flex flex-col w-full" @finish="onSubmit">
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
              :disabled="true"
              data-testid="nc-account-settings-email-input"
            />
            <div class="flex flex-row w-full justify-end mt-8">
              <NcButton
                type="primary"
                html-type="submit"
                :disabled="isErrored || (form.title && form.title === currentUser?.display_name)"
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
