<script lang="ts" setup>
/**
 * Base settings → API Tokens.
 *
 * Reuses the account token surface wholesale; the only difference is that the
 * token is pinned to this base, so the Access step has nothing to choose.
 */
interface Props {
  baseId: string
}

defineProps<Props>()
</script>

<template>
  <AccountToken :locked-base-id="baseId" />
</template>
