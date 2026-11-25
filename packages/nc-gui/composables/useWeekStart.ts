const USER_META_KEY = 'week_start'

export type WeekStart = 'monday' | 'sunday'

/** The signed-in user's first day of the week for date pickers. Monday unless set. */
export const useWeekStart = () => {
  const { user } = useGlobal()

  const weekStart = computed<WeekStart>(() => (parseProp(user.value?.meta)?.[USER_META_KEY] === 'sunday' ? 'sunday' : 'monday'))

  const isMondayFirst = computed(() => weekStart.value === 'monday')

  const setWeekStart = (value: WeekStart) => useUsers().updateUserMeta({ [USER_META_KEY]: value })

  return { weekStart, isMondayFirst, setWeekStart }
}
