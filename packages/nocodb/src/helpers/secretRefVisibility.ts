import type { NcRequest } from '~/interface/config';

/** CE has no vaults, so a config holds no reference to hide. */
export function hideSecretRefIds(_req: NcRequest, _config: unknown): void {}
