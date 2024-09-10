import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { validatePassword } from 'nocodb-sdk';
import boxen from 'boxen';
import isEmail from 'validator/lib/isEmail';
import { T } from '~/utils';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { BaseUser, User } from '~/models';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import { randomTokenString } from '~/services/users/helpers';

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
          },
        ),
        '\n',
      );
      process.exit(1);
    }

    const { valid, error, hint } = validatePassword(
      process.env.NC_ADMIN_PASSWORD,
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
        '\n',
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
        salt,
      );
      const email_verification_token = uuidv4();
      const roles = 'org-level-creator,super';

      // if super admin not present
      if (await User.isFirst(ncMeta)) {
        // roles = 'owner,creator,editor'
        T.emit('evt', {
          evt_type: 'base:invite',
          count: 1,
        });

        await User.insert(
          {
            email,
            salt,
            password,
            email_verification_token,
            token_version: randomTokenString(),
            roles,
          },
          ncMeta,
        );
      } else {
        const salt = await promisify(bcrypt.genSalt)(10);
        const password = await promisify(bcrypt.hash)(
          process.env.NC_ADMIN_PASSWORD,
          salt,
        );
        const email_verification_token = uuidv4();
        // TODO improve this
        const superUsers = await ncMeta.metaList2(
          RootScopes.ROOT,
          RootScopes.ROOT,
          MetaTable.USERS,
        );

        let superUserPresent = false;

        for (const user of superUsers) {
          if (!user.roles?.includes('super')) continue;

          superUserPresent = true;

          if (email !== user.email) {
            // update admin email and password and migrate bases
            // if user already present and associated with some base

            // check user account already present with the new admin email
            const existingUserWithNewEmail = await User.getByEmail(
              email,
              ncMeta,
            );

            if (existingUserWithNewEmail?.id) {
              // get all base access belongs to the existing account
              // and migrate to the admin account
              const existingUserProjects = await ncMeta
                .knexConnection(MetaTable.PROJECT_USERS)
                .where({ fk_user_id: existingUserWithNewEmail.id });

              for (const existingUserProject of existingUserProjects) {
                const userProject = await BaseUser.get(
                  existingUserProject.base_id,
                  user.id,
                  ncMeta,
                );

                // if admin user already have access to the base
                // then update role based on the highest access level
                if (userProject) {
                  if (
                    rolesLevel[userProject.roles] >
                    rolesLevel[existingUserProject.roles]
                  ) {
                    await BaseUser.update(
                      {
                        workspace_id: existingUserProject.workspace_id,
                        base_id: existingUserProject.base_id,
                      },
                      userProject.base_id,
                      user.id,
                      existingUserProject.roles,
                      ncMeta,
                    );
                  }
                } else {
                  // if super doesn't have access then add the access
                  await BaseUser.insert(
                    {
                      ...existingUserProject,
                      fk_user_id: user.id,
                    },
                    ncMeta,
                  );
                }
                // delete the old base access entry from DB
                await BaseUser.delete(
                  existingUserProject.base_id,
                  existingUserProject.fk_user_id,
                  ncMeta,
                );
              }

              // delete existing user
              await ncMeta.metaDelete(
                RootScopes.ROOT,
                RootScopes.ROOT,
                MetaTable.USERS,
                existingUserWithNewEmail.id,
              );

              await NocoCache.del(
                `${CacheScope.USER}:${existingUserWithNewEmail.id}`,
              );
              await NocoCache.del(
                `${CacheScope.USER}:${existingUserWithNewEmail.email}`,
              );

              // Update email and password of super admin account
              await User.update(
                user.id,
                {
                  salt,
                  email,
                  password,
                  email_verification_token,
                  token_version: randomTokenString(),
                },
                ncMeta,
              );
            } else {
              // if no user present with the new admin email update the email and password
              await User.update(
                user.id,
                {
                  salt,
                  email,
                  password,
                  email_verification_token,
                  token_version: randomTokenString(),
                },
                ncMeta,
              );
            }
          } else {
            const newPasswordHash = await promisify(bcrypt.hash)(
              process.env.NC_ADMIN_PASSWORD,
              user.salt,
            );

            if (newPasswordHash !== user.password) {
              // if email's are same and passwords are different
              // then update the password and token version
              await User.update(
                user.id,
                {
                  salt,
                  password,
                  email_verification_token,
                  token_version: randomTokenString(),
                },
                ncMeta,
              );
            }
          }
        }

        if (!superUserPresent) {
          // check user account already present with the new admin email
          const existingUserWithNewEmail = await User.getByEmail(email, ncMeta);
          if (existingUserWithNewEmail?.id) {
            await NocoCache.del(
              `${CacheScope.USER}:${existingUserWithNewEmail.id}`,
            );
            await NocoCache.del(
              `${CacheScope.USER}:${existingUserWithNewEmail.email}`,
            );

            // Update password and roles of existing user
            await User.update(
              existingUserWithNewEmail.id,
              {
                salt,
                email,
                password,
                email_verification_token,
                token_version: randomTokenString(),
                roles,
              },
              ncMeta,
            );
          } else {
            // no super user present and no user present with the new admin email
            T.emit('evt', {
              evt_type: 'base:invite',
              count: 1,
            });

            await User.insert(
              {
                email,
                salt,
                password,
                email_verification_token,
                token_version: randomTokenString(),
                roles,
              },
              ncMeta,
            );
          }
        }
      }

      await ncMeta.commit();
    } catch (e) {
      console.log('Error occurred while updating/creating admin user');
      await ncMeta.rollback(e);
      throw e;
    }
  }
}
