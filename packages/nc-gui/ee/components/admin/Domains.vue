<script lang="ts" setup>
import { onMounted } from '@vue/runtime-core'

const { domains, fetchDomains, getPrePopulatedDomain, verifyDomain, deleteDomain } = useDomains()

const domainDialogShow = ref(false)
const domainProp = ref()
const isEdit = computed(() => domainProp.value?.id)

const populatingDomain = ref(false)

const addDomain = async () => {
  populatingDomain.value = true
  domainProp.value = await getPrePopulatedDomain()
  domainDialogShow.value = true
  isEdit.value = true
  populatingDomain.value = false
}

const enableEdit = async (domain) => {
  isEdit.value = true
  domainProp.value = domain
  domainDialogShow.value = true
}

onMounted(async () => {
  await fetchDomains()
})
</script>

<template>
  <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2" data-test-id="nc-org-domain">
    <div class="flex font-bold text-base" data-rec="true">{{ $t('labels.domain') }}</div>
    <div class="">
      <h1 class="text-md text-gray-800">
        Verify your domain ownership to manage it’s user accounts and setup SSO Authentication.
      </h1>

      <template v-for="(domain, id) of domains" :key="id">
        <div
          v-if="!domain.deleted"
          :data-test-id="`nc-domain-${domain.domain}`"
          class="flex flex-row justify-between my-2 nc-domain w-full items-center p-3 hover:bg-gray-50 border-1 first:border-t-1 border-x-1 rounded cursor-pointer group text-gray-600"
          @click="enableEdit(domain)"
        >
          <div class="flex-grow">{{ domain.domain }}</div>

          <div class="w-50" :class="{ 'text-success-500': domain.verified }">
            <span
              class="nc-domain-status"
              :class="{
                verified: domain.verified,
                progress: domain.verifying,
                failed: !domain.verified,
              }"
            >
              <template v-if="domain.verifying"><a-spin size="small" /> &nbsp;Verifying</template>
              <template v-else>
                <NcTooltip placement="top">
                  <template #title>
                    <template v-if="domain.verified"> Domain verified last at {{ domain.last_verified }} </template>
                    <template v-else>
                      Confirm the TXT record in your DNS settings, then verify your domain by clicking on the 'Verify' option in
                      the three-dot menu
                    </template>
                  </template>
                  <div class="inline-flex gap-2 items-center">
                    <GeneralIcon :icon="domain.verified ? 'check' : 'error'" />
                    {{ domain.verified ? 'Verified' : 'Not verified' }}
                  </div>
                </NcTooltip>
              </template>
            </span>
          </div>
          <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md" @click.stop>
            <NcButton class="!text-gray-500 !hover:text-gray-800" data-test-id="nc-domain-more-option" size="xsmall" type="text">
              <GeneralIcon class="text-inherit" icon="threeDotVertical" />
            </NcButton>
            <template #overlay>
              <NcMenu>
                <NcMenuItem data-test-id="nc-domain-verify" @click="verifyDomain(domain.id)">
                  <div class="flex flex-row items-center">
                    <component :is="iconMap.check" class="text-gray-800" />
                    <span class="text-gray-800 ml-2"> {{ $t('general.verify') }} </span>
                  </div>
                </NcMenuItem>
                <NcMenuItem data-test-id="nc-domain-edit" @click="enableEdit(domain)">
                  <div class="flex flex-row items-center">
                    <component :is="iconMap.edit" class="text-gray-800" />
                    <span class="text-gray-800 ml-2"> {{ $t('general.edit') }} </span>
                  </div>
                </NcMenuItem>
                <a-menu-divider class="my-1.5" />
                <NcMenuItem data-test-id="nc-domain-delete" @click="deleteDomain(domain.id)">
                  <div class="text-red-500">
                    <GeneralIcon class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" icon="delete" />
                    {{ $t('general.delete') }}
                  </div>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>
      </template>
      <div class="flex justify-end">
        <NcButton
          :disabled="populatingDomain"
          :loading="populatingDomain"
          data-test-id="nc-org-domain-add"
          size="small"
          @click="addDomain"
        >
          <GeneralIcon class="text-inherit" icon="plus" />
          {{ $t('labels.addDomain') }}
        </NcButton>
      </div>
    </div>
    <DlgOrgDomain
      v-if="domainDialogShow"
      v-model:model-value="domainDialogShow"
      :domain="domainProp"
      :is-edit="isEdit"
      @save="fetchDomains()"
    />
  </div>
</template>

<style scoped lang="scss">
.nc-domain-status {
  @apply border-1 py-1 px-2 rounded-lg inline-flex gap-1 items-center;

  &.verified {
    @apply bg-success/10 text-success border-transparent;
  }
  &.failed {
    @apply bg-error/5 text-error border-transparent;
  }
}
</style>
