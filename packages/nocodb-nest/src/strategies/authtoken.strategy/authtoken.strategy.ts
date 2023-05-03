import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-custom'
import { ApiToken, ProjectUser, User } from '../../models'

@Injectable()
export class AuthTokenStrategy extends PassportStrategy(Strategy, 'authtoken') {
  async validate(req: any, callback: Function) {
    try {
      let user
      if (req.headers['xc-token']) {

        const apiToken = await ApiToken.getByToken(
          req.headers['xc-token'],
        )
        if (!apiToken) {
          return callback({ msg: 'Invalid token' })
        }

        user = {}
        if (!apiToken.fk_user_id) {
          user.roles = 'editor'
          return callback(null, user)
        }

        const dbUser: Record<string, any> = await User.get(apiToken.fk_user_id)
        if (!dbUser) {
          return callback({ msg: 'User not found' })
        }

        dbUser.is_api_token = true
        if (req['ncProjectId']) {
          const projectUser = await ProjectUser.get(
            req['ncProjectId'],
            dbUser.id,
          )
          user.roles = projectUser?.roles || dbUser.roles
          user.roles = user.roles === 'owner' ? 'owner,creator' : user.roles
          return callback(null, user)
        }
      }
      return callback(null, user)
    } catch (error) {
      callback(error)
    }
  }
}
