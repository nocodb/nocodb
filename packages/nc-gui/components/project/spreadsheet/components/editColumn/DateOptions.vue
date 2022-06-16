<template>
	<v-text-field
	v-model="colMeta.date_format"
	label="Date Format"
	class="caption nc-column-name-input"
	dense
	outlined
	></v-text-field>
</template>
<script>
export default {
	name: "DateOptions",
	props: ['column', 'meta', 'value'],
	data: () => ({
		colMeta: {
			date_format:"YYYY-MM-DD"
		}
  	}),
	watch: {
		value() {
			this.colMeta = this.value || {}
		},
		colMeta(v) {
			this.$emit('input', v)
		}
  	},
	created() {
		this.colMeta = this.value ? { ...this.value } : { ...this.colMeta }
	}
}
</script>
