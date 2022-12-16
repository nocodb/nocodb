import { extractSdkResponseErrorMsg, useGlobal, useNuxtApp, useRouter } from '#imports'

export function useProfile() {
  const { user } = useGlobal()

  const { $api } = useNuxtApp()

  const router = useRouter()

  const profile = ref()

  const isFollowing = ref()

  const loadIsFollowingUser = async (userId: string) => {
    if (!userId) return
    try {
      console.log('user.value!.id', user.value!.id)
      console.log('userId', userId)
      isFollowing.value = await $api.orgUsers.isFollowing(user.value!.id, userId)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const loadProfile = async (username: string) => {
    if (!username) return

    try {
      const user = await $api.orgUsers.getByUsername(username)
      profile.value = await $api.orgUsers.profileGet(user.id)
      await loadIsFollowingUser(user.id)
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return router.push('/error/404')
      }
      throw e
    }
  }

  const followUser = async (userId: string) => {
    if (!userId) return
    try {
      $api.orgUsers.followerCreate(user.value!.id, {
        fk_follower_id: userId,
      })
      await loadIsFollowingUser(userId)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const unfollowUser = async (userId: string) => {
    if (!userId) return
    try {
      $api.orgUsers.followerDelete(user.value!.id, {
        fk_follower_id: userId,
      })
      await loadIsFollowingUser(userId)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    loadProfile,
    profile,
    followUser,
    unfollowUser,
    loadIsFollowingUser,
    isFollowing,
  }
}
