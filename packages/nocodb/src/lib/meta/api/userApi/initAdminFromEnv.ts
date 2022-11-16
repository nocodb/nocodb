import User from '../../../models/User';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

import bcrypt from 'bcryptjs';
import Noco from '../../../Noco';
import { CacheScope, MetaTable } from '../../../utils/globals';
import ProjectUser from '../../../models/ProjectUser';
import { validatePassword } from 'nocodb-sdk';
import boxen from 'boxen';
import NocoCache from '../../../cache/NocoCache';
import { Tele } from 'nc-help';

const { isEmail } = require('validator');
const rolesLevel = { owner: 0, creator: 1, editor: 2, commenter: 3, viewer: 4 };

export default async function initAdminFromEnv(_ncMeta = Noco.ncMeta) {
  if (process.env.NC_ADMIN_EMAIL && process.env.NC_ADMIN_PASSWORD) {
    if (!isEmail(process.env.NC_ADMIN_EMAIL?.trim())) {
      console.log(
        '\n',
        boxen(
          `Provided admin email '${process.env.NC_ADMIN_EMAIL}'  is not valid`,
          {
            title: 'Invalid admin email',
            padding: 1,
            borderStyle: 'double',
            titleAlignment: 'center',
            borderColor: 'red',
          }
        ),
        '\n'
      );
      process.exit(1);
    }

    const { valid, error, hint } = validatePassword(
      process.env.NC_ADMIN_PASSWORD
    );
    if (!valid) {
      console.log(
        '\n',
        boxen(`${error}${hint ? `\n\n${hint}` : ''}`, {
          title: 'Invalid admin password',
          padding: 1,
          borderStyle: 'double',
          titleAlignment: 'center',
          borderColor: 'red',
        }),
        '\n'
      );
      process.exit(1);
    }

    let ncMeta;
    try {
      ncMeta = await _ncMeta.startTransaction();
      const email = process.env.NC_ADMIN_EMAIL.toLowerCase().trim();

      const salt = await promisify(bcrypt.genSalt)(10);
      const password = await promisify(bcrypt.hash)(
        process.env.NC_ADMIN_PASSWORD,
        salt
      );
      const email_verification_token = uuidv4();
      const roles = 'user,super';

      // if super admin not present
      if (await User.isFirst(ncMeta)) {
        // roles = 'owner,creator,editor'
        Tele.emit('evt', {
          evt_type: 'project:invite',
          count: 1,
        });

        await User.insert(
          {
            firstname: '',
            lastname: '',
            email,
            salt,
            password,
            email_verification_token,
            roles,
          },
          ncMeta
        );
      } else {
        const salt = await promisify(bcrypt.genSalt)(10);
        const password = await promisify(bcrypt.hash)(
          process.env.NC_ADMIN_PASSWORD,
          salt
        );
        const email_verification_token = uuidv4();
        const superUser = await ncMeta.metaGet2(null, null, MetaTable.USERS, {
          roles: 'user,super',
        });

        if (!superUser?.id) {
          const existingUserWithNewEmail = await User.getByEmail(email, ncMeta);
          if (existingUserWithNewEmail?.id) {
            // clear cache
            await NocoCache.delAll(
              CacheScope.USER,
              `${existingUserWithNewEmail.email}___*`
            );
            await NocoCache.del(
              `${CacheScope.USER}:${existingUserWithNewEmail.id}`
            );
            await NocoCache.del(
              `${CacheScope.USER}:${existingUserWithNewEmail.email}`
            );

            // Update email and password of super admin account
            await User.update(
              existingUserWithNewEmail.id,
              {
                salt,
                email,
                password,
                email_verification_token,
                token_version: null,
                refresh_token: null,
                roles,
              },
              ncMeta
            );
          } else {
            Tele.emit('evt', {
              evt_type: 'project:invite',
              count: 1,
            });

            await User.insert(
              {
                firstname: '',
                lastname: '',
                email,
                salt,
                password,
                email_verification_token,
                roles,
              },
              ncMeta
            );
          }
        } else if (email !== superUser.email) {
          // update admin email and password and migrate projects
          // if user already present and associated with some project

          // check user account already present with the new admin email
          const existingUserWithNewEmail = await User.getByEmail(email, ncMeta);

          if (existingUserWithNewEmail?.id) {
            // get all project access belongs to the existing account
            // and migrate to the admin account
            const existingUserProjects = await ncMeta.metaList2(
              null,
              null,
              MetaTable.PROJECT_USERS,
              {
                condition: { fk_user_id: existingUserWithNewEmail.id },
              }
            );

            for (const existingUserProject of existingUserProjects) {
              const userProject = await ProjectUser.get(
                existingUserProject.project_id,
                superUser.id,
                ncMeta
              );

              // if admin user already have access to the project
              // then update role based on the highest access level
              if (userProject) {
                if (
                  rolesLevel[userProject.roles] >
                  rolesLevel[existingUserProject.roles]
                ) {
                  await ProjectUser.update(
                    userProject.project_id,
                    superUser.id,
                    existingUserProject.roles,
                    ncMeta
                  );
                }
              } else {
                // if super doesn't have access then add the access
                await ProjectUser.insert(
                  {
                    ...existingUserProject,
                    fk_user_id: superUser.id,
                  },
                  ncMeta
                );
              }
              // delete the old project access entry from DB
              await ProjectUser.delete(
                existingUserProject.project_id,
                existingUserProject.fk_user_id,
                ncMeta
              );
            }

            // delete existing user
            await ncMeta.metaDelete(
              null,
              null,
              MetaTable.USERS,
              existingUserWithNewEmail.id
            );

            // clear cache
            await NocoCache.delAll(
              CacheScope.USER,
              `${existingUserWithNewEmail.email}___*`
            );
            await NocoCache.del(
              `${CacheScope.USER}:${existingUserWithNewEmail.id}`
            );
            await NocoCache.del(
              `${CacheScope.USER}:${existingUserWithNewEmail.email}`
            );

            // Update email and password of super admin account
            await User.update(
              superUser.id,
              {
                salt,
                email,
                password,
                email_verification_token,
                token_version: null,
                refresh_token: null,
              },
              ncMeta
            );
          } else {
            // if email's are not different update the password and hash
            await User.update(
              superUser.id,
              {
                salt,
                email,
                password,
                email_verification_token,
                token_version: null,
                refresh_token: null,
              },
              ncMeta
            );
          }
        } else {
          const newPasswordHash = await promisify(bcrypt.hash)(
            process.env.NC_ADMIN_PASSWORD,
            superUser.salt
          );

          if (newPasswordHash !== superUser.password) {
            // if email's are same and passwords are different
            // then update the password and token version
            await User.update(
              superUser.id,
              {
                salt,
                password,
                email_verification_token,
                token_version: null,
                refresh_token: null,
              },
              ncMeta
            );
          }
        }
      }
      await ncMeta.commit();
    } catch (e) {
      console.log('Error occurred while updating/creating admin user');
      console.log(e);
      await ncMeta.rollback(e);
    }
  }
}
