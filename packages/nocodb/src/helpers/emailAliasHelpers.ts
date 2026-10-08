import Noco from '~/Noco';
import { User } from '~/models';
import { isEmailAlias } from '~/utils/emailUtils';

// Aliases an invite would mint a new account for; an existing account on its exact address stays invitable.
export async function aliasesWithoutAccount(
  emails: string[],
  ncMeta = Noco.ncMeta,
): Promise<string[]> {
  const aliases: string[] = [];
  for (const email of emails) {
    if (isEmailAlias(email) && !(await User.getByEmail(email, ncMeta))) {
      aliases.push(email);
    }
  }
  return aliases;
}
