import {store} from 'nuxt3-store'

export  const useUser = () =>{
  const user =  store({
    name: 'user',
    type: 'localstorage',
    value: {token: null},
    reactiveType: 'reactive',
    version: '1.0.0'
  })

  const setToken = (token) => { user.token = token }

  return {user,setToken}
}
