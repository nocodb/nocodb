export enum RoadmapStatus {
  TRIAGE = 'triage',
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
  CANCELED = 'canceled',
  DUPLICATE = 'duplicate',
}

export enum RoadmapPublicStatus {
  UNDER_REVIEW = 'under_review',
  BACKLOG = 'backlog',
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  SHIPPED = 'shipped',
  CLOSED = 'closed',
  DECLINED = 'declined',
  MERGED = 'merged',
}

export const ROADMAP_PUBLISHED_STATUSES: readonly RoadmapStatus[] = [
  RoadmapStatus.BACKLOG,
  RoadmapStatus.TODO,
  RoadmapStatus.IN_PROGRESS,
  RoadmapStatus.IN_REVIEW,
  RoadmapStatus.DONE,
];

export const ROADMAP_STARTED_STATUSES: readonly RoadmapStatus[] = [
  RoadmapStatus.IN_PROGRESS,
  RoadmapStatus.IN_REVIEW,
];

export const ROADMAP_STAFF_BOARD_STATUSES: readonly RoadmapStatus[] = [
  RoadmapStatus.TRIAGE,
  RoadmapStatus.BACKLOG,
  RoadmapStatus.TODO,
  RoadmapStatus.IN_PROGRESS,
  RoadmapStatus.IN_REVIEW,
  RoadmapStatus.DONE,
];

export const ROADMAP_PUBLIC_BOARD_STATUSES: readonly RoadmapPublicStatus[] = [
  RoadmapPublicStatus.BACKLOG,
  RoadmapPublicStatus.PLANNED,
  RoadmapPublicStatus.IN_PROGRESS,
  RoadmapPublicStatus.SHIPPED,
];

export const ROADMAP_PUBLIC_TO_INTERNAL_STATUSES: Partial<
  Record<RoadmapPublicStatus, readonly RoadmapStatus[]>
> = {
  [RoadmapPublicStatus.BACKLOG]: [RoadmapStatus.BACKLOG],
  [RoadmapPublicStatus.PLANNED]: [RoadmapStatus.TODO],
  [RoadmapPublicStatus.IN_PROGRESS]: [
    RoadmapStatus.IN_PROGRESS,
    RoadmapStatus.IN_REVIEW,
  ],
  [RoadmapPublicStatus.SHIPPED]: [RoadmapStatus.DONE],
};

export function roadmapPublicStatus(item: {
  status: RoadmapStatus | string;
  published_at?: string | Date | null;
}): RoadmapPublicStatus {
  switch (item.status) {
    case RoadmapStatus.TRIAGE:
      return RoadmapPublicStatus.UNDER_REVIEW;
    case RoadmapStatus.BACKLOG:
      return RoadmapPublicStatus.BACKLOG;
    case RoadmapStatus.TODO:
      return RoadmapPublicStatus.PLANNED;
    case RoadmapStatus.IN_PROGRESS:
    case RoadmapStatus.IN_REVIEW:
      return RoadmapPublicStatus.IN_PROGRESS;
    case RoadmapStatus.DONE:
      return RoadmapPublicStatus.SHIPPED;
    case RoadmapStatus.DUPLICATE:
      return RoadmapPublicStatus.MERGED;
    default:
      return item.published_at
        ? RoadmapPublicStatus.CLOSED
        : RoadmapPublicStatus.DECLINED;
  }
}

export enum RoadmapVisibility {
  PUBLIC = 'public',
  INTERNAL = 'internal',
}

export enum RoadmapPriority {
  NONE = 0,
  URGENT = 1,
  HIGH = 2,
  MEDIUM = 3,
  LOW = 4,
}

export const ROADMAP_PRIORITY_LABELS: Record<RoadmapPriority, string> = {
  [RoadmapPriority.NONE]: 'No priority',
  [RoadmapPriority.URGENT]: 'Urgent',
  [RoadmapPriority.HIGH]: 'High',
  [RoadmapPriority.MEDIUM]: 'Medium',
  [RoadmapPriority.LOW]: 'Low',
};

export enum RoadmapDateResolution {
  MONTH = 'month',
  QUARTER = 'quarter',
  HALF_YEAR = 'half_year',
  YEAR = 'year',
}

export enum RoadmapLabelGroupType {
  SINGLE = 'single',
  MULTI = 'multi',
}

export enum RoadmapRelationType {
  BLOCKS = 'blocks',
  RELATED = 'related',
}

export enum RoadmapLinkSource {
  GITHUB_PR = 'github_pr',
  GITHUB_ISSUE = 'github_issue',
  SLACK = 'slack',
  INTERCOM = 'intercom',
  GONG = 'gong',
  DOC = 'doc',
  URL = 'url',
}

export enum RoadmapView {
  ALL = 'all',
  MINE = 'mine',
  TEAM = 'team',
  VOTED = 'voted',
  TRIAGE = 'triage',
  ASSIGNED = 'assigned',
  INTERNAL = 'internal',
}

export const ROADMAP_STAFF_VIEWS: readonly RoadmapView[] = [
  RoadmapView.TRIAGE,
  RoadmapView.ASSIGNED,
  RoadmapView.INTERNAL,
];

export enum RoadmapSort {
  TOP = 'top',
  NEW = 'new',
  REVENUE = 'revenue',
  PRIORITY = 'priority',
  MANUAL = 'manual',
  UPDATED = 'updated',
}

export const ROADMAP_STAFF_SORTS: readonly RoadmapSort[] = [
  RoadmapSort.REVENUE,
  RoadmapSort.PRIORITY,
  RoadmapSort.MANUAL,
  RoadmapSort.UPDATED,
];

export enum RoadmapListState {
  OPEN = 'open',
  SHIPPED = 'shipped',
  CLOSED = 'closed',
}

export enum RoadmapSubscriptionReason {
  CREATOR = 'creator',
  VOTE = 'vote',
  ASSIGNEE = 'assignee',
  COMMENT = 'comment',
  MANUAL = 'manual',
}

export enum RoadmapActivityType {
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  PUBLIC_STATUS_CHANGED = 'public_status_changed',
  MERGED_IN = 'merged_in',
  MERGED_INTO = 'merged_into',
  CLOSED = 'closed',
  STATUS_CHANGED = 'status_changed',
  EDITED = 'edited',
  DECLINED = 'declined',
  UNPUBLISHED = 'unpublished',
  ASSIGNED = 'assigned',
  PRIORITY_CHANGED = 'priority_changed',
  ESTIMATE_CHANGED = 'estimate_changed',
  LABELS_CHANGED = 'labels_changed',
  TARGET_CHANGED = 'target_changed',
  VISIBILITY_CHANGED = 'visibility_changed',
  RELATION_ADDED = 'relation_added',
  RELATION_REMOVED = 'relation_removed',
  LINK_ADDED = 'link_added',
  LINK_UPDATED = 'link_updated',
  LINK_REMOVED = 'link_removed',
  VOTES_ADJUSTED = 'votes_adjusted',
  META_CHANGED = 'meta_changed',
  COMMENT_HIDDEN = 'comment_hidden',
  COMMENT_PINNED = 'comment_pinned',
}

export const ROADMAP_PUBLIC_ACTIVITY_TYPES: readonly RoadmapActivityType[] = [
  RoadmapActivityType.SUBMITTED,
  RoadmapActivityType.APPROVED,
  RoadmapActivityType.PUBLIC_STATUS_CHANGED,
  RoadmapActivityType.MERGED_IN,
  RoadmapActivityType.MERGED_INTO,
  RoadmapActivityType.CLOSED,
];

export type RoadmapAudience = 'staff' | 'customer' | 'public';

export type RoadmapHqMode = 'off' | 'staff' | 'all';

export const ROADMAP_LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 120,
  DESCRIPTION_MAX: 10_000,
  COMMENT_MAX: 5_000,
  CLOSE_REASON_MAX: 1_000,
  ATTACHMENTS_MAX: 5,
  ATTACHMENT_SIZE_MAX: 10 * 1024 * 1024,
  META_KEYS_MAX: 100,
  META_BYTES_MAX: 16 * 1024,
  META_KEY_PATTERN: /^[A-Za-z0-9_.:-]{1,64}$/,
  LINKS_PER_ITEM_MAX: 50,
  RELATIONS_PER_ITEM_MAX: 50,
  OPEN_TRIAGE_PER_USER_MAX: 10,
  SUBMISSIONS_PER_DAY_MAX: 20,
  COMMENTS_PER_HOUR_MAX: 60,
  PAGE_SIZE_DEFAULT: 25,
  PAGE_SIZE_MAX: 100,
  BOARD_COLUMN_SIZE_DEFAULT: 20,
} as const;

export type RoadmapJsonValue =
  | string
  | number
  | boolean
  | null
  | RoadmapJsonValue[]
  | { [key: string]: RoadmapJsonValue };

/** Accepted attachment types by file extension; the server derives the mimetype from this, never from the client. */
export const ROADMAP_ATTACHMENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export function roadmapAttachmentMimetype(name: string | null | undefined) {
  const ext = /\.([a-z0-9]+)$/i.exec(name ?? '')?.[1]?.toLowerCase();
  return (ext && ROADMAP_ATTACHMENT_TYPES[ext]) || null;
}


export type RoadmapMeta = Record<string, RoadmapJsonValue>;

export type RoadmapAuthor =
  | { kind: 'you'; name: string; handle: string | null }
  | { kind: 'teammate'; name: string }
  | { kind: 'staff'; name: string }
  | { kind: 'customer'; handle: string }
  | { kind: 'deleted' };

export interface RoadmapAccountRef {
  workspace: { id: string; title: string } | null;
  org: { id: string; title: string } | null;
  plan: string | null;
}

export type RoadmapStaffAuthor =
  | ({
      kind: 'full';
      userId: string;
      name: string;
      email: string;
      isStaff: boolean;
    } & RoadmapAccountRef)
  | { kind: 'deleted'; userId: string };

export interface RoadmapUserRef {
  id: string;
  name: string;
  email: string;
}

export interface RoadmapLabelRef {
  id: string;
  title: string;
  color: string | null;
  groupId: string | null;
}

export interface RoadmapLabel extends RoadmapLabelRef {
  description: string | null;
  isGroup: boolean;
  groupType: RoadmapLabelGroupType | null;
  isPublic: boolean;
  order: number;
  archived: boolean;
}

export interface RoadmapTarget {
  date: string;
  resolution: RoadmapDateResolution | null;
}

export interface RoadmapItemRef {
  id: string;
  /** Resolves the request's URL; the slug beside it is derived from the title. */
  number: number;
  title: string;
}

export interface RoadmapAttachment {
  /** Set once saved: the attachment's FileReference, which the proxy serves it by. */
  id?: string;
  path?: string;
  url?: string;
  /** Only on a fresh upload, for the composer preview; saved attachments go through the proxy. */
  signedUrl?: string;
  signedPath?: string;
  title: string;
  mimetype: string;
  size: number;
}

interface RoadmapItemCardBase {
  id: string;
  /** Resolves this request's URL. `identifier` renders it as RM-12 for staff. */
  number: number;
  title: string;
  publicStatus: RoadmapPublicStatus;
  labels: RoadmapLabelRef[];
  /** Real votes plus the staff adjustment, floored. */
  votes: number;
  commentCount: number;
  target: RoadmapTarget | null;
  publishedAt: string | null;
  completedAt: string | null;
}

export interface RoadmapItemCardPublic extends RoadmapItemCardBase {
  audience: 'public';
  author: RoadmapAuthor;
}

export interface RoadmapViewerState {
  voted: boolean;
  subscribed: boolean;
  muted: boolean;
  isMine: boolean;
}

export interface RoadmapItemCardCustomer
  extends RoadmapItemCardBase,
    RoadmapViewerState {
  audience: 'customer';
  author: RoadmapAuthor;
  /** Only on the viewer's own items: an unapproved request has no `publishedAt`. */
  createdAt?: string;
}

export interface RoadmapImpactSummary {
  mrrCents: number;
  accounts: number;
  submitterPlan: string | null;
  computedAt: string | null;
}

export interface RoadmapItemCardStaff
  extends RoadmapItemCardBase,
    RoadmapViewerState {
  audience: 'staff';
  author: RoadmapStaffAuthor;
  identifier: string;
  number: number;
  status: RoadmapStatus;
  visibility: RoadmapVisibility;
  priority: RoadmapPriority;
  estimate: number | null;
  assignee: RoadmapUserRef | null;
  sortOrder: number;
  realVotes: number;
  voteAdjustment: number;
  impact: RoadmapImpactSummary;
  isStaffCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RoadmapItemCard = RoadmapItemCardCustomer | RoadmapItemCardStaff;

export interface RoadmapMergedFrom extends RoadmapItemRef {
  mergedAt: string | null;
}

interface RoadmapItemDetailExtras {
  description: string | null;
  closeReason: string | null;
  duplicateOf: RoadmapItemRef | null;
  canEdit: boolean;
  canDelete: boolean;
  canVote: boolean;
  canComment: boolean;
  attachments: RoadmapAttachment[];
}

export interface RoadmapItemDetailPublic
  extends RoadmapItemCardPublic,
    Omit<
      RoadmapItemDetailExtras,
      'canEdit' | 'canDelete' | 'canVote' | 'canComment' | 'attachments'
    > {}

export interface RoadmapItemDetailCustomer
  extends RoadmapItemCardCustomer,
    RoadmapItemDetailExtras {}

export interface RoadmapRelation {
  id: string;
  type: RoadmapRelationType;
  /** `blocked_by` is the inverse read of a `blocks` row. */
  direction: 'blocks' | 'blocked_by' | 'related';
  item: RoadmapItemRef & {
    identifier: string;
    status: RoadmapStatus;
  };
  createdAt: string;
}

export interface RoadmapLink {
  id: string;
  url: string;
  title: string | null;
  source: RoadmapLinkSource;
  createdBy: RoadmapUserRef | null;
  createdAt: string;
}

export interface RoadmapItemDetailStaff
  extends RoadmapItemCardStaff,
    RoadmapItemDetailExtras {
  mergedFrom: RoadmapMergedFrom[];
  meta: RoadmapMeta;
  links: RoadmapLink[];
  relations: RoadmapRelation[];
  approvedAt: string | null;
  triagedAt: string | null;
  startedAt: string | null;
  canceledAt: string | null;
  statusChangedAt: string | null;
}

export type RoadmapItemDetail =
  | RoadmapItemDetailCustomer
  | RoadmapItemDetailStaff;

export interface RoadmapComment {
  id: string;
  itemId: string;
  parentId: string | null;
  /** Plain text, HTML-escaped. Older rows may hold sanitized HTML. */
  body: string;
  author: RoadmapAuthor | RoadmapStaffAuthor;
  /** Author's staff snapshot, which drives the NocoDB badge. */
  isStaff: boolean;
  isInternal: boolean;
  pinned: boolean;
  hidden: boolean;
  likeCount: number;
  liked: boolean;
  /** False once the request is closed to engagement. */
  canLike: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string;
  editedAt: string | null;
  attachments: RoadmapAttachment[];
  replies: RoadmapComment[];
}

export interface RoadmapActivity {
  id: string;
  type: RoadmapActivityType;
  actor: RoadmapAuthor | RoadmapStaffAuthor | null;
  details: Record<string, RoadmapJsonValue>;
  createdAt: string;
}

export interface RoadmapVoter {
  user: RoadmapUserRef;
  isStaff: boolean;
  votedAt: string;
  workspace: RoadmapAccountRef['workspace'];
  org: RoadmapAccountRef['org'];
  plan: string | null;
}

export interface RoadmapVoterList {
  list: RoadmapVoter[];
  total: number;
  realVotes: number;
  voteAdjustment: number;
}

export interface RoadmapImpactAccount {
  scopeType: 'workspace' | 'org';
  scopeId: string;
  title: string | null;
  plan: string | null;
  mrrCents: number;
  voterCount: number;
}

export interface RoadmapImpact {
  mrrCents: number;
  arrCents: number;
  accounts: number;
  submitterPlan: string | null;
  computedAt: string | null;
  topAccounts: RoadmapImpactAccount[];
  plans: { plan: string; accounts: number; mrrCents: number }[];
}

export interface RoadmapSimilarItem {
  id: string;
  number: number;
  title: string;
  votes: number;
  voted: boolean;
  publicStatus: RoadmapPublicStatus;
  /** Staff only. */
  status?: RoadmapStatus;
}

export interface RoadmapBootstrap {
  mode: RoadmapHqMode;
  me: {
    handle: string | null;
    isStaff: boolean;
    isOrgOwner: boolean;
    emailOptOut: boolean;
    /** Staff viewing as a customer. */
    preview: boolean;
  };
  labels: RoadmapLabel[];
  counts: {
    views: Partial<Record<RoadmapView, number>>;
    publicStatuses: Partial<Record<RoadmapPublicStatus, number>>;
    /** Staff only. */
    statuses?: Partial<Record<RoadmapStatus, number>>;
    labels: Record<string, number>;
  };
  latestShippedAt: string | null;
}

export interface RoadmapLatestShipped {
  latestShippedAt: string | null;
}

export interface RoadmapBoardColumn {
  status: RoadmapStatus | RoadmapPublicStatus;
  total: number;
  items: RoadmapItemCard[];
}

export interface RoadmapBoard {
  columns: RoadmapBoardColumn[];
}

export interface RoadmapPage<T> {
  list: T[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

export interface RoadmapItemListPage extends RoadmapPage<RoadmapItemCard> {
  /** With `stateCounts`: each tab's total under the same filters. Only the requested tab applies the status filter. */
  stateCounts?: Record<RoadmapListState, number>;
}

export interface RoadmapItemListParams {
  view?: RoadmapView;
  labelIds?: string[];
  /** Public status for customers, internal status for staff. */
  status?: string[];
  state?: RoadmapListState;
  q?: string;
  sort?: RoadmapSort;
  teamScope?: 'workspace' | 'org';
  assigneeId?: string;
  priority?: RoadmapPriority[];
  visibility?: RoadmapVisibility;
  plan?: string;
  limit?: number;
  offset?: number;
  stateCounts?: boolean | string;
}

export interface RoadmapItemCreatePayload {
  title: string;
  description?: string | null;
  labelIds?: string[];
  attachments?: RoadmapAttachment[];
  // Staff only
  status?: RoadmapStatus;
  visibility?: RoadmapVisibility;
  priority?: RoadmapPriority;
  estimate?: number | null;
  assigneeId?: string | null;
  targetDate?: string | null;
  targetDateResolution?: RoadmapDateResolution | null;
  meta?: RoadmapMeta;
}

export interface RoadmapItemUpdatePayload {
  itemId: string;
  title?: string;
  description?: string | null;
  labelIds?: string[];
  attachments?: RoadmapAttachment[];
  // Staff only
  priority?: RoadmapPriority;
  estimate?: number | null;
  assigneeId?: string | null;
  targetDate?: string | null;
  targetDateResolution?: RoadmapDateResolution | null;
  visibility?: RoadmapVisibility;
  voteAdjustment?: number;
  voteAdjustmentNote?: string;
  sortOrder?: number;
}

export interface RoadmapItemSetStatusPayload {
  itemId: string;
  status: RoadmapStatus;
  closeReason?: string;
  title?: string;
  description?: string | null;
  /** Board drag: rank within the target column. */
  sortOrder?: number;
}

export interface RoadmapItemMergePayload {
  sourceId: string;
  targetId: string;
  title?: string;
  description?: string | null;
}

export interface RoadmapItemMetaUpdatePayload {
  itemId: string;
  set?: RoadmapMeta;
  unset?: string[];
}

export interface RoadmapRelationPayload {
  itemId: string;
  relatedItemId: string;
  type: RoadmapRelationType;
}

export interface RoadmapLinkAddPayload {
  itemId: string;
  url: string;
  title?: string | null;
  source?: RoadmapLinkSource;
}

export interface RoadmapLinkUpdatePayload {
  linkId: string;
  url?: string;
  title?: string | null;
  source?: RoadmapLinkSource;
}

export interface RoadmapCommentCreatePayload {
  itemId: string;
  body: string;
  parentId?: string | null;
  internal?: boolean;
  notifyVoters?: boolean;
  attachments?: RoadmapAttachment[];
}

export interface RoadmapCommentUpdatePayload {
  commentId: string;
  body: string;
  /** Omit to keep the current attachments. */
  attachments?: RoadmapAttachment[];
}

export interface RoadmapLabelUpsertPayload {
  id?: string;
  title: string;
  description?: string | null;
  color?: string | null;
  groupId?: string | null;
  isGroup?: boolean;
  groupType?: RoadmapLabelGroupType | null;
  isPublic?: boolean;
  order?: number;
}

/** The full new order of one group's labels, or of the groups themselves when `groupId` is null. */
export interface RoadmapLabelReorderPayload {
  groupId: string | null;
  ids: string[];
}

/** `nc_notifications.type` for every roadmap notification. */
export const ROADMAP_NOTIFICATION_TYPE = 'roadmap_update';

export enum RoadmapNotificationEvent {
  APPROVED = 'approved',
  DECLINED = 'declined',
  STATUS_CHANGED = 'status_changed',
  MERGED = 'merged',
  ASSIGNED = 'assigned',
  STAFF_REPLY = 'staff_reply',
  COMMENT = 'comment',
  INTERNAL_COMMENT = 'internal_comment',
  REPLY = 'reply',
}

/** Customer bodies carry public facts only; `status` and `identifier` are staff-only. */
export interface RoadmapNotificationBody {
  itemId: string;
  itemTitle: string;
  event: RoadmapNotificationEvent;
  publicStatus?: RoadmapPublicStatus;
  closeReason?: string | null;
  commentId?: string;
  commentExcerpt?: string;
  duplicateOf?: RoadmapItemRef | null;
  actorName?: string | null;
  status?: RoadmapStatus;
  identifier?: string;
}

/** Result of the signed mute link in roadmap emails; works signed out. */
export interface RoadmapMuteByTokenResult {
  itemId: string;
  itemTitle: string;
  muted: boolean;
}

export function roadmapIdentifier(number: number) {
  return `RM-${number}`;
}

const SLUG_MAX = 72;

/** Lowercase ASCII words joined by hyphens, accents folded, cut on a word boundary. */
export function roadmapSlugify(title: string): string {
  const folded = (title ?? '')
    .normalize('NFKD')
    // Strip the combining marks left by the decomposition above.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (folded.length <= SLUG_MAX) return folded;
  const cut = folded.slice(0, SLUG_MAX);
  const lastBreak = cut.lastIndexOf('-');
  return (lastBreak > SLUG_MAX / 2 ? cut.slice(0, lastBreak) : cut).replace(
    /-+$/,
    '',
  );
}

/** `12/column-level-permissions`: the number resolves it, so a rename keeps old links working. */
export function roadmapItemSegment(number: number, title: string): string {
  const slug = roadmapSlugify(title);
  return slug ? `${number}/${slug}` : String(number);
}

/** An `rmi` id in the URL is a link from before numbered URLs. */
export function isRoadmapItemId(segment: string): boolean {
  return /^rmi[a-z0-9]+$/i.test(segment ?? '');
}

export function roadmapDisplayedVotes(
  voteCount: number,
  voteAdjustment: number,
  viewerVoted: boolean,
) {
  return Math.max(
    (voteCount || 0) + (voteAdjustment || 0),
    viewerVoted ? 1 : 0,
    0,
  );
}
