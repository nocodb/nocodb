<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '~/lib'

const props = defineProps<{
  row: RowType
  fields?: ColumnType[]
  compactMode?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { row, fields } = toRefs(props)

const expandedFormDlg = ref(false)
const expandedFormRowState = ref<Record<string, any>>()

const { isUIAllowed } = useRoles()

function openExpandedForm() {
  expandedFormDlg.value = true
  expandedFormRowState.value = undefined
}
</script>
