<script setup lang="ts">
import type { RoleLabels } from 'nocodb-sdk'
import { OrderedProjectRoles, ProjectRoles } from 'nocodb-sdk'
import type { User } from '#imports'
import { extractEmail } from '~/helpers/parsers/parserHelpers'

const props = defineProps<{
  modelValue: boolean
  baseId?: string
}>()
const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const inviteData = reactive({
  email: '',
  roles: ProjectRoles.NO_ACCESS,
})

const { baseRoles } = useRoles()

const basesStore = useBases()

const { activeProjectId } = storeToRefs(basesStore)

const { createProjectUser } = basesStore

const divRef = ref<HTMLDivElement>()

const focusRef = ref<HTMLInputElement>()
const isDivFocused = ref(false)

const emailValidation = reactive({
  isError: true,
  message: '',
})

const allowedRoles = ref<ProjectRoles[]>([])

onMounted(async () => {
  try {
    const currentRoleIndex = OrderedProjectRoles.findIndex(
      (role) => baseRoles.value && Object.keys(baseRoles.value).includes(role),
    )
    if (currentRoleIndex !== -1) {
      allowedRoles.value = OrderedProjectRoles.slice(currentRoleIndex + 1).filter((r) => r)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
})
const singleEmailValue = ref('')

const emailBadges = ref<Array<string>>([])

const insertOrUpdateString = (str: string) => {
  // Check if the string already exists in the array
  const index = emailBadges.value.indexOf(str)

  if (index !== -1) {
    // If the string exists, remove it
    emailBadges.value.splice(index, 1)
  }

  // Add the new string to the array
  emailBadges.value.push(str)
}

const emailInputValidation = (input: string, isBulkEmailCopyPaste: boolean = false): boolean => {
  if (!input.length) {
    if (isBulkEmailCopyPaste) return false

    emailValidation.isError = true
    emailValidation.message = 'Email should not be empty'
    return false
  }
  if (!validateEmail(input.trim())) {
    if (isBulkEmailCopyPaste) return false

    emailValidation.isError = true
    emailValidation.message = 'Invalid Email'
    return false
  }
  return true
}

const isInvitButtonDiabled = computed(() => {
  if (!emailBadges.value.length && !singleEmailValue.value.length) {
    return true
  }
  if (emailBadges.value.length && inviteData.email) {
    return true
  }
})

watch(inviteData, (newVal) => {
  // when user only want to enter a single email
  // we dont convert that as badge

  const isSingleEmailValid = validateEmail(newVal.email)
  if (isSingleEmailValid && !emailBadges.value.length) {
    singleEmailValue.value = newVal.email
    emailValidation.isError = false
    return
  }
  singleEmailValue.value = ''

  // when user enters multiple emails comma sepearted or space sepearted
  const isNewEmail = newVal.email.charAt(newVal.email.length - 1) === ',' || newVal.email.charAt(newVal.email.length - 1) === ' '
  if (isNewEmail && newVal.email.trim().length) {
    const emailToAdd = newVal.email.split(',')[0].trim() || newVal.email.split(' ')[0].trim()
    if (!validateEmail(emailToAdd)) {
      emailValidation.isError = true
      emailValidation.message = 'Invalid Email'
      return
    }
    /**
     if email is already enterd we delete the already
     existing email and add new one
     **/
    if (emailBadges.value.includes(emailToAdd)) {
      insertOrUpdateString(emailToAdd)
      inviteData.email = ''
      return
    }
    emailBadges.value.push(emailToAdd)
    inviteData.email = ''
    singleEmailValue.value = ''
  }
  if (!newVal.email.length && emailValidation.isError) {
    emailValidation.isError = false
  }
})

const handleEnter = () => {
  const isEmailIsValid = emailInputValidation(inviteData.email)
  if (!isEmailIsValid) return

  inviteData.email += ' '
  emailValidation.isError = false
  emailValidation.message = ''
}

const focusOnDiv = () => {
  focusRef.value?.focus()
  isDivFocused.value = true
}

// remove one email per backspace
onKeyStroke('Backspace', () => {
  if (isDivFocused.value && inviteData.email.length < 1) {
    emailBadges.value.pop()
  }
})

watch(dialogShow, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      focusOnDiv()
    }, 100)
  }
})

// when bulk email is pasted
const onPaste = (e: ClipboardEvent) => {
  emailValidation.isError = false

  const pastedText = e.clipboardData?.getData('text')

  const inputArray = pastedText?.split(',') || pastedText?.split(' ')

  // if data is pasted to a already existing text in input
  // we add existingInput + pasted data
  if (inputArray?.length === 1 && inviteData.email.length) {
    inputArray[0] = inviteData.email += inputArray[0]
  }

  inputArray?.forEach((el) => {
    el = extractEmail(el) || el

    const isEmailIsValid = emailInputValidation(el, inputArray.length > 1)

    if (!isEmailIsValid) return

    /**
     if email is already enterd we delete the already
     existing email and add new one
     **/
    if (emailBadges.value.includes(el)) {
      insertOrUpdateString(el)
      return
    }
    emailBadges.value.push(el)

    inviteData.email = ''
  })
  inviteData.email = ''
}

const inviteProjectCollaborator = async () => {
  try {
    const payloadData = singleEmailValue.value || emailBadges.value.join(',')
    if (!payloadData.includes(',')) {
      const validationStatus = validateEmail(payloadData)
      if (!validationStatus) {
        emailValidation.isError = true
        emailValidation.message = 'invalid email'
      }
    }
    await createProjectUser(activeProjectId.value!, {
      email: payloadData,
      roles: inviteData.roles,
    } as unknown as User)

    message.success('Invitation sent successfully')
    inviteData.email = ''
    emailBadges.value = []
    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    singleEmailValue.value = ''
  }
}

const onRoleChange = (role: keyof typeof RoleLabels) => (inviteData.roles = role as ProjectRoles)
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="medium"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-row items-center gap-x-2">
        {{ $t('activity.addMember') }}
      </div>
    </template>
    <div class="flex items-center justify-between gap-3 mt-2">
      <div class="flex w-full flex-col">
        <div class="flex justify-between gap-3 w-full">
          <div
            ref="divRef"
            class="flex items-center border-1 gap-1 w-full overflow-x-auto nc-scrollbar-x-md items-center h-10 rounded-lg !min-w-96"
            tabindex="0"
            :class="{
              'border-primary/100': isDivFocused,
              'p-1': emailBadges?.length > 1,
            }"
            @click="focusOnDiv"
            @blur="isDivFocused = false"
          >
            <span
              v-for="(email, index) in emailBadges"
              :key="email"
              class="border-1 text-gray-800 bg-gray-100 rounded-md flex items-center px-2 py-1"
            >
              {{ email }}
              <component
                :is="iconMap.close"
                class="ml-0.5 hover:cursor-pointer mt-0.5 w-4 h-4"
                @click="emailBadges.splice(index, 1)"
              />
            </span>
            <input
              id="email"
              ref="focusRef"
              v-model="inviteData.email"
              :placeholder="$t('activity.enterEmail')"
              class="w-full min-w-36 outline-none px-2"
              data-testid="email-input"
              @keyup.enter="handleEnter"
              @blur="isDivFocused = false"
              @paste.prevent="onPaste"
            />
          </div>
          <RolesSelector
            size="lg"
            class="nc-invite-role-selector"
            :role="inviteData.roles"
            :roles="allowedRoles"
            :on-role-change="onRoleChange"
            :description="false"
          />
        </div>

        <span v-if="emailValidation.isError && emailValidation.message" class="ml-2 text-red-500 text-[10px] mt-1.5">{{
          emailValidation.message
        }}</span>
      </div>
    </div>
    <div class="flex mt-8 justify-end">
      <div class="flex gap-2">
        <NcButton type="secondary" @click="dialogShow = false"> {{ $t('labels.cancel') }} </NcButton>
        <NcButton
          type="primary"
          size="medium"
          :disabled="isInvitButtonDiabled || emailValidation.isError"
          @click="inviteProjectCollaborator"
        >
          {{ $t('activity.inviteToBase') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
