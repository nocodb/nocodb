import { extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type OAuthClient from '~/models/OAuthClient';
import { User } from '~/models';
import { NcError } from '~/helpers/ncError';

type Principal = NcRequest['user'] & {
  isAuthorized?: boolean;
  is_oauth_token?: boolean;
  isPublicBase?: boolean;
};

// Consent and client management accept only the console's own session.
export function assertFirstPartySession(
  context: NcContext | undefined,
  req: NcRequest,
) {
  const user = req.user as Principal | undefined;

  if (!user?.isAuthorized || !user.id) {
    NcError.get(context).unauthorized('Invalid token');
  }

  if (user.is_api_token) {
    NcError.get(context).apiTokenNotAllowed();
  }

  if (user.is_oauth_token || user.isPublicBase) {
    NcError.get(context).forbidden('Not allowed for this token');
  }
}

export async function isInstanceAdmin(userId?: string | null) {
  if (!userId) return false;
  const user = await User.get(userId);
  return !!extractRolesObj(user?.roles)?.[OrgUserRoles.SUPER_ADMIN];
}

// Verified = registered by an instance admin; DCR and member clients are not.
export async function isVerifiedOAuthClient(
  client: Pick<OAuthClient, 'fk_user_id'>,
) {
  // Role is read at request time, so promotion verifies a user's existing clients.
  return isInstanceAdmin(client.fk_user_id);
}

// Unicode TR39 confusables (confusables.txt 18.0) of n, o, c, d and b in any
// case, small capitals included, minus those NFKC already folds to ASCII.
const LOOKALIKES: Record<string, string[]> = {
  n: [
    '\u0274\u039D\u0578\u057C\u2C9A\u2C9B\uA4E0\u{10513}',
    '\u{11ABE}\u{1CCE3}\u{1D6B4}\u{1D6EE}\u{1D728}\u{1D762}\u{1D79C}',
  ],
  o: [
    '\u0030\u039F\u03BF\u03C3\u03ED\u041E\u043E\u0555',
    '\u0585\u05E1\u0647\u0665\u06BE\u06C1\u06D5\u06F5',
    '\u07C0\u07CB\u0840\u0966\u09E6\u0A66\u0AE6\u0B20',
    '\u0B66\u0BE6\u0C02\u0C66\u0C82\u0CE6\u0D02\u0D20',
    '\u0D66\u0D82\u0E50\u0ED0\u101D\u1040\u10FF\u110B',
    '\u11BC\u12D0\u17E0\u1A45\u1A80\u1A90\u1BEA\u1C82',
    '\u1CBF\u1D0F\u1D11\u2C9E\u2C9F\u2D54\u3007\u3147',
    '\uA4F3\uAB3D\uFBA6\uFBA7\uFBA8\uFBA9\uFBAA\uFBAB',
    '\uFBAC\uFBAD\uFEE9\uFEEA\uFEEB\uFEEC\uFF10\uFFB7',
    '\u{10292}\u{102AB}\u{1030F}\u{10404}\u{1042C}\u{104C2}\u{104EA}\u{10516}',
    '\u{1092C}\u{10C17}\u{10D07}\u{11124}\u{11302}\u{114D0}\u{118B5}\u{118C8}',
    '\u{118D7}\u{118E0}\u{11DE0}\u{16AE9}\u{1CCE4}\u{1CCF0}\u{1D6B6}\u{1D6D0}',
    '\u{1D6D4}\u{1D6F0}\u{1D70A}\u{1D70E}\u{1D72A}\u{1D744}\u{1D748}\u{1D764}',
    '\u{1D77E}\u{1D782}\u{1D79E}\u{1D7B8}\u{1D7BC}\u{1D7CE}\u{1D7D8}\u{1D7E2}',
    '\u{1D7EC}\u{1D7F6}\u{1E140}\u{1E2F0}\u{1EE24}\u{1EE84}\u{1FBF0}',
  ],
  c: [
    '\u03F2\u03F9\u0421\u0441\u1004\u105A\u13DF\u1C83',
    '\u1D04\u2CA4\u2CA5\uA4DA\uABAF\u{102A2}\u{10302}\u{10415}',
    '\u{1043D}\u{1051B}\u{118E9}\u{118F2}\u{1CCD8}\u{1D134}\u{1F74C}',
  ],
  d: [
    '\u0501\u13A0\u13E7\u146F\u15DE\u15EA\u1D05\uA4D2',
    '\uA4D3\uAB70\u{1018B}\u{1CCD9}',
  ],
  b: [
    '\u0184\u0299\u0392\u0412\u042C\u0432\u07D5\u13CF',
    '\u13F4\u13FC\u1472\u15AF\u15F7\u2C82\u2C83\uA4D0',
    '\uA557\uA7B4\u{10282}\u{102A1}\u{10301}\u{1031C}\u{16EB6}\u{1CCD7}',
    '\u{1D207}\u{1D6A9}\u{1D6E3}\u{1D71D}\u{1D757}\u{1D791}',
  ],
};

const LOOKALIKE_TO_LATIN = new Map<string, string>(
  Object.entries(LOOKALIKES).flatMap(([latin, chunks]) =>
    [...chunks.join('')].map((ch): [string, string] => [ch, latin]),
  ),
);

const foldLookalikes = (value: string) =>
  [...value].map((ch) => LOOKALIKE_TO_LATIN.get(ch) ?? ch).join('');

// Only a leading match is reserved: MCP clients register names like "Claude Code (nocodb)".
export function isReservedOAuthClientName(name: unknown) {
  if (typeof name !== 'string') return false;
  // Separators and invisibles go; other letters stay, so they can only fail the match.
  const folded = foldLookalikes(
    foldLookalikes(name.normalize('NFKC')).toLowerCase(),
  )
    .replace(
      /[\p{P}\p{Z}\p{S}\p{C}\p{M}\p{Default_Ignorable_Code_Point}]/gu,
      '',
    )
    // "cl" reads as "d": "Nococlb".
    .replace(/cl/g, 'd');
  return folded.startsWith('nocodb');
}
