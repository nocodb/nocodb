/** The file every skill has: frontmatter plus the markdown body. */
export const SKILL_ENTRY_FILE = 'SKILL.md';

/** NocoDB's own curated catalog, browsable without naming a repo. */
export const NOCODB_SKILLS_REPO = 'nocodb/assistant-skills';

export enum SkillSourceType {
  /** Installed from {@link NOCODB_SKILLS_REPO}. */
  OFFICIAL = 'official',
  /** Installed from any other public `owner/repo` on skills.sh's convention. */
  COMMUNITY = 'community',
}

/**
 * Where a skill is filed. The containment chain, plus the individual.
 *
 * Everything but `USER` is a *shared* catalog: it reaches both plain chat and
 * agents for every base underneath it. `USER` reaches only that person's own
 * chat, never an agent — an agent runs for whoever triggers it, so a skill
 * only one member can see would make its behaviour unreproducible.
 */
export enum SkillScopeType {
  /** Enterprise only. Spans every workspace under the org. */
  ORG = 'org',
  WORKSPACE = 'workspace',
  BASE = 'base',
  USER = 'user',
}

/**
 * Nearest scope wins when two skills share a title, so a base can override
 * the workspace's version of a procedure without renaming it.
 */
export const SKILL_SCOPE_PRECEDENCE: SkillScopeType[] = [
  SkillScopeType.BASE,
  SkillScopeType.WORKSPACE,
  SkillScopeType.ORG,
  SkillScopeType.USER,
];

/**
 * `scope_id` is resolved server-side from the route (org / workspace / base)
 * or the session (user) — never read off the payload, which only ever names
 * *which* scope it means.
 */
export interface SkillScope {
  scope: SkillScopeType;
  scope_id: string;
}

/** Which repos may be imported into a workspace's or org's catalogs. */
export enum SkillCommunityPolicy {
  ANY = 'any',
  ALLOWLIST = 'allowlist',
  NONE = 'none',
}

/** Whether members' own catalogs load inside this workspace's bases. */
export enum SkillPersonalPolicy {
  ALLOWED = 'allowed',
  OFFICIAL_ONLY = 'official_only',
  DISABLED = 'disabled',
}

/**
 * An org's block replaces a workspace's wholesale rather than merging, so
 * "what applies here" is always one object, never a computed blend.
 */
export interface SkillPolicyType {
  community: SkillCommunityPolicy;
  /** `owner/repo` entries, consulted only when `community` is `allowlist`. */
  allowlist: string[];
  personal: SkillPersonalPolicy;
}

/** Permissive — identical to the behaviour before policy existed. */
export const DEFAULT_SKILL_POLICY: SkillPolicyType = {
  community: SkillCommunityPolicy.ANY,
  allowlist: [],
  personal: SkillPersonalPolicy.ALLOWED,
};

/**
 * Presentation grouping, straight from the skill's frontmatter.
 *
 * Deliberately a plain string rather than a closed enum: a community repo can
 * ship any category it likes, and a value we don't recognise must still render
 * (it simply falls back to the neutral colour) instead of breaking the row.
 */
export type SkillCategory = string;

/** The categories NocoDB's own catalog uses — drives filter pills and colour. */
export const SKILL_CATEGORIES = [
  'Reports',
  'Analysis',
  'Comms',
  'Decks',
  'Sheets',
  'Web',
] as const;

export interface SkillFile {
  path: string;
  contents: string;
}

/** One entry of a stored skill's bundle, as listed to the model. */
export interface SkillFileEntry {
  path: string;
  size: number;
}

export interface SkillType {
  id?: string;

  scope?: SkillScopeType;
  scope_id?: string;

  title?: string;
  description?: string;

  /** Frontmatter grouping — the badge beside the name, and the filter pills. */
  category?: SkillCategory;
  /** Author-declared, e.g. `1.4`. Compared against the catalog to offer an update. */
  version?: string;
  /** Icon key from the frontmatter; falls back to a category default. */
  icon?: string;

  /**
   * Key into bundle storage, where `SKILL.md` and every auxiliary file live.
   * The body is deliberately not a column: a skill is a folder, and only the
   * few listing fields above belong on the per-turn hot path.
   */
  content_hash?: string;

  /** Owner-controlled pause switch — a disabled skill is never offered to the model. */
  enabled?: boolean;

  source_type?: SkillSourceType;
  /** `owner/repo/skillName`, or `owner/repo` for a root-level skill. Unset for `custom`. */
  source_ref?: string;
  /** Commit installed from, so an update check needs no download. */
  source_commit?: string;

  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;

  /**
   * Set only on resolved listings, never stored: this skill shares its title
   * with one at a nearer scope and so is not offered to the model.
   */
  shadowed_by?: SkillScopeType;
}

export interface SkillUpdateReqType {
  enabled?: boolean;
}

/** One browsable skill in a GitHub catalog, before it is installed. */
export interface SkillCatalogEntryType {
  /** `owner/repo/skillName` — or `owner/repo` when the repo root is itself the skill. The handle `skillImport` takes. */
  source_ref: string;
  title: string;
  description?: string;
  category?: SkillCategory;
  version?: string;
  icon?: string;
  /** Everything in the folder, so the browser can show what it would install. */
  files: string[];
}

export interface SkillCatalogReqType {
  source_type: SkillSourceType.OFFICIAL | SkillSourceType.COMMUNITY;
  /** `owner/repo`. Ignored for `official`, which always uses NocoDB's catalog. */
  repo?: string;
}

export interface SkillImportReqType {
  /**
   * `owner/repo/skillName` — or `owner/repo` for a root-level skill. Exactly as
   * the catalog listed it. The only thing an install names: whether the repo is
   * official is derived from it, never declared.
   */
  source_ref: string;
}

export interface SkillPolicyUpdateReqType {
  community?: SkillCommunityPolicy;
  allowlist?: string[];
  personal?: SkillPersonalPolicy;
}

/**
 * One row of the org-wide inventory: every shared skill installed anywhere
 * under the org, with the upstream revision it came from.
 */
export interface SkillInventoryRowType extends SkillType {
  workspace_id?: string;
  workspace_title?: string;
  base_title?: string;
}
