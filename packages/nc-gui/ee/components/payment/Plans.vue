<script lang="ts" setup>
const { plansAvailable, paymentMode, getPlanPrice, onSelectPlan, onPaymentModeChange } = usePaymentStoreOrThrow()
</script>

<template>
  <div class="flex flex-col">
    <div class="flex">
      <div class="text-2xl font-bold mb-4">Plans & Pricing</div>
      <!-- toggle annual & monthly -->
      <div class="flex-1"></div>
      <div class="flex items-center gap-2">
        <div class="text-sm">Monthly</div>
        <NcSwitch :checked="paymentMode === 'year'" @change="onPaymentModeChange" />
        <div class="text-sm">Annual</div>
      </div>
    </div>
    <div class="flex space-x-8">
      <div class="nc-border-gray-medium p-4 shadow-default rounded-lg w-[300px]">
        <div class="text-lg">Free</div>
        <div class="flex items-center gap-1 my-4">
          <span class="text-xl">$</span><span class="text-3xl font-bold">0</span>/seat/month
        </div>

        <NcButton type="ghost" size="small" class="w-full my-4" disabled>
          <div class="flex items-center justify-center gap-1">Current Plan</div>
        </NcButton>

        <div class="flex flex-col mt-4">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>10k rows / workspace</div>
          </div>
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>1GB storage</div>
          </div>
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>5 API request / second</div>
          </div>
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>All user roles</div>
          </div>
        </div>
      </div>
      <div v-for="plan in plansAvailable" :key="plan.title" class="nc-border-gray-medium p-4 shadow-default rounded-lg w-[300px]">
        <div class="text-lg">{{ plan.title }}</div>
        <div class="flex items-center gap-1 my-4">
          <div class="text-xl">$</div>
          <div class="text-3xl font-bold">{{ getPlanPrice(plan) }}</div>
          /seat/month
        </div>

        <NcButton type="primary" size="small" class="w-full my-4" @click="onSelectPlan(plan)">
          <div class="flex items-center justify-center gap-1">Upgrade Plan</div>
        </NcButton>

        <div class="flex flex-col mt-4">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>50k rows / workspace</div>
          </div>
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>10GB storage</div>
          </div>
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>5 API request / second</div>
          </div>
          <div class="flex items-center gap-2">
            <GeneralIcon icon="ncCheck" class="h-4 w-4 text-green-600" />
            <div>Public views with password</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
