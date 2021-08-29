import {Tele} from 'nc-help';
import passport from 'passport';
import {Strategy} from 'passport-jwt';
import {v4 as uuidv4} from 'uuid';
import validator from "validator";

import XcCache from "../plugins/adapters/cache/XcCache";

import RestAuthCtrl from "./RestAuthCtrl";

export default class RestAuthCtrlEE extends RestAuthCtrl {


  protected async addAdmin(req, res, next): Promise<any> {

    const emails = (req.body.email || '').split(/\s*,\s*/).map(v => v.trim());

    // check for invalid emails
    const invalidEmails = emails.filter(v => !validator.isEmail(v))
    if (!emails.length) {
      return next(new Error('Invalid email address'));
    }
    if (invalidEmails.length) {
      return next(new Error('Invalid email address : ' + invalidEmails.join(', ')));
    }


    // todo: handle roles which contains super
    if (!req.session?.passport?.user?.roles?.owner && req.body.roles.indexOf('owner') > -1) {
      return next(new Error('Insufficient privilege to add super admin role.'));
    }

    const invite_token = uuidv4();
    const error = [];

    for (const email of emails) {

      // add user to project if user already exist
      const user = await this.users.where({email}).first();
      if (user) {
        if (!await this.xcMeta.isUserHaveAccessToProject(req.body.project_id, user.id)) {
          await this.xcMeta.projectAddUser(req.body.project_id, user.id, 'editor');
        }
        this.xcMeta.audit(req.body.project_id, null, 'nc_audit', {
          op_type: 'AUTHENTICATION',
          op_sub_type: 'INVITE',
          user: req.user.email,
          description: `invited ${email} to ${req.body.project_id} project `, ip: req.clientIp
        })
      } else {
        try {
          // create new user with invite token
          await this.users.insert({
            invite_token,
            invite_token_expires: new Date(Date.now() + (24 * 60 * 60 * 1000)),
            email,
            roles: 'user'
          });

          const {id} = await this.users.where({email}).first();
          const count = await this.users.count('id').first();
          // add user to project
          await this.xcMeta.projectAddUser(req.body.project_id, id, req.body.roles);

          Tele.emit('evt', {evt_type: 'project:invite', count: count?.count});

          this.xcMeta.audit(req.body.project_id, null, 'nc_audit', {
            op_type: 'AUTHENTICATION',
            op_sub_type: 'INVITE',
            user: req.user.email,
            description: `invited ${email} to ${req.body.project_id} project `, ip: req.clientIp
          })
          // in case of single user check for smtp failure
          // and send back token if failed
          if (emails.length === 1 && !await this.sendInviteEmail(email, invite_token, req)) {
            return res.json({invite_token, email});
          } else {
            this.sendInviteEmail(email, invite_token, req)
          }
        } catch (e) {
          if (emails.length === 1) {
            return next(e);
          } else {
            error.push({email, error: e.message})
          }
        }
      }

    }

    if (emails.length === 1) {
      res.json({
        msg: 'success'
      })
    } else {
      return res.json({invite_token, emails, error});
    }
  }

  protected async updateAdmin(req, res, next): Promise<any> {

    if (!req?.body?.project_id) {
      return next(new Error('Missing project id in request body.'));
    }

    if (req.session?.passport?.user?.roles?.owner && req.session?.passport?.user?.id === +req.params.id && req.body.roles.indexOf('owner') === -1) {
      return next(new Error('Super admin can\'t remove Super role themselves'));
    }
    try {
      const user = await this.users.where({
        id: req.params.id
      }).first();

      if (!user) {
        return next(`User with id '${req.params.id}' doesn't exist`);
      }

      // todo: handle roles which contains super
      if (!req.session?.passport?.user?.roles?.owner && req.body.roles.indexOf('owner') > -1) {
        return next(new Error('Insufficient privilege to add super admin role.'));
      }

      // await this.users.update({
      //   roles: req.body.roles
      // }).where({
      //   id: req.params.id
      // });


      await this.xcMeta.metaUpdate(req?.body?.project_id, null, 'nc_projects_users', {
        roles: req.body.roles
      }, {
        user_id: req.params.id,
        // email: req.body.email
      });

      XcCache.del(`${req.body.email}___${req?.body?.project_id}`);


      this.xcMeta.audit(null, null, 'nc_audit', {
        op_type: 'AUTHENTICATION',
        op_sub_type: 'ROLES_MANAGEMENT',
        user: req.user.email,
        description: `updated roles for ${user.email} with ${req.body.roles} `, ip: req.clientIp
      })

      res.json({
        msg: 'User details updated successfully'
      })

    } catch (e) {
      next(e);
    }

  }

  protected initJwtStrategy(): void {
    passport.use(new Strategy({
      ...this.jwtOptions,
      passReqToCallback: true
    }, (req, jwtPayload, done) => {

      const keyVals = [jwtPayload?.email]
      if (req.ncProjectId) {
        keyVals.push(req.ncProjectId);
      }
      const key = keyVals.join('___');
      const cachedVal = XcCache.get(key);
      if (cachedVal) {
        return done(null, cachedVal);
      }

      this.users.where({
        email: jwtPayload?.email
      }).first().then(user => {
        if (req.ncProjectId) {
          this.xcMeta.metaGet(req.ncProjectId, null, 'nc_projects_users', {
            user_id: user?.id
          }).then(projectUser => {
            user.roles = projectUser.roles;
            XcCache.set(key, user);
            done(null, user)
          })

        } else {
          // const roles = projectUser?.roles ? JSON.parse(projectUser.roles) : {guest: true};
          if (user) {
            XcCache.set(key, user);
            return done(null, user);
          } else {
            return done(new Error('User not found'));
          }
        }
      }).catch(err => {
        return done(err);
      })
    }));
  }

}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
