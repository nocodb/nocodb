import { extractRolesObj, isServiceUser, parseProp } from 'nocodb-sdk';
import type { FormType, UserType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { isCloud } from '~/utils/constants';
import { getUsersWithBaseAccess } from '~/helpers/baseAccessHelpers';

/**
 * Where a form submission's copy goes: the signed-in submitter of a
 * require-sign-in form that sends response copies, or null. Shared by the
 * mailer and the submit response so the form never promises a copy it won't send.
 */
export async function getFormResponseCopyRecipient(
  context: NcContext,
  {
    formView,
    user,
    isFeatureEnabled,
  }: {
    formView: Pick<FormType, 'meta'>;
    user?: UserType;
    isFeatureEnabled: () => Promise<boolean>;
  },
): Promise<string | null> {
  const meta = parseProp(formView?.meta);
  if (
    !meta.require_signin ||
    !meta.send_response_copy ||
    !user?.id ||
    !user.email ||
    isServiceUser(user) ||
    (extractRolesObj(user.roles) as Record<string, boolean>)?.guest ||
    !(await isFeatureEnabled())
  ) {
    return null;
  }
  // Off cloud, signup doesn't verify the address: mail a verified one or a member's
  if (!isCloud && !user.email_verified) {
    const email = user.email.toLowerCase();
    const members = await getUsersWithBaseAccess(context, {
      baseId: context.base_id,
    });
    if (!members.some((u) => u.email?.toLowerCase() === email)) return null;
  }
  return user.email;
}
