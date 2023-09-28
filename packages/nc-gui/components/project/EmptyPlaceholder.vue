<script lang="ts" setup>
import { stringifyRolesObj } from 'nocodb-sdk'
import {NcProjectType} from '#imports'

const projectType = ref()
const projectCreateDlg = ref(false)

const { isUIAllowed } = useUIPermission()

const { allRoles } = useRoles()

const openCreateProjectDlg = (type: NcProjectType) => {
    projectType.value = type
    projectCreateDlg.value = true
}
</script>

<template>
    <div class="p-10">
        <h1 class="text-3xl font-semibold mb-4">
            No Projects in workspace
        </h1>
        <h4 class="text-sm font-semibold text-gray-400 mb-10">
            Looks like you don't have any project in this workspace
        </h4>
        <h1 class="text-xl font-medium">
            Get started by creating a new project ..
        </h1>
        <div v-if="isUIAllowed('tableCreate', false, stringifyRolesObj(allRoles))" class="flex flex-row gap-x-6 pb-3 pt-6">
            <div class="nc-project-view-all-table-btn" data-testid="proj-view-btn__add-new-table"
                @click="openCreateProjectDlg(NcProjectType.DB)">
                <GeneralIcon icon="addOutlineBox" />
                <div class="label">{{ $t('general.new') }} {{ $t('general.empty') }} {{ $t('objects.project') }}</div>
            </div>
        </div>
    </div>
    <WorkspaceCreateProjectDlg v-model="projectCreateDlg" />
</template>

<style lang="scss" scoped>
.nc-project-view-all-table-btn {
    @apply flex flex-col gap-y-6 p-4 bg-gray-100 rounded-xl w-56 cursor-pointer text-gray-600 hover: (bg-gray-100 !text-black);

    .nc-icon {
        @apply h-10 w-10;
    }

    .label {
        @apply text-base font-medium;
    }
}
</style>
