<script lang="ts" setup>
import type { FormBuilderElement } from 'nocodb-sdk'

const props = defineProps<{
  value: {
    code_verifier: string
    code: string
  }
  element: FormBuilderElement
  haveValue?: boolean
  formData?: Record<string, any>
}>()

const emits = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emits)

const { performOAuthDance } = useOAuthPopup()

const OAuthConfig = computed(() => {
  return props.element.oauthMeta!
})

const handleOAuth = async () => {
  const result = await performOAuthDance(OAuthConfig.value, props.formData)

  if (!result) return

  vModel.value = result
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <WorkspaceIntegrationsFormsEditOrAddPerUserToggle v-if="isEeUI" />
    <NcButton type="primary" class="self-start" @click="handleOAuth">
      <div class="flex items-center gap-2">
        <div class="font-bold">Authenticate With {{ OAuthConfig.provider }}</div>
        <template v-if="haveValue">
          <GeneralIcon icon="circleCheckSolid" class="text-success w-6 h-6" />
        </template>
      </div>
    </NcButton>
  </div>
</template>

<style></style>
