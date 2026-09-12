const DAY_MS = 86_400_000;

export function computeCleanupDueAt(
  deletedAtIso: string,
  retentionDays: number,
): string | null {
  if (retentionDays < 0) return null;
  return new Date(
    new Date(deletedAtIso).getTime() + retentionDays * DAY_MS,
  ).toISOString();
}

export function parseTrashRetentionEnv(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < -1) return null;
  return n;
}
