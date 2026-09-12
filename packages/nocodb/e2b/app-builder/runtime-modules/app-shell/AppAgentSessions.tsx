// Platform-owned — restored every turn. Never edit.
//
// Conversation management, in both forms the assistant takes. The full-page
// sidebar and the compact popover render the SAME rows: rename is inline
// (double-click or the pencil), delete asks once, and "New chat" starts an
// untitled conversation that the first turn names by itself.
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { AppAgentSessionType } from "@nocodb/app-ctx/agent";
import { fieldInteractive, floating, ghostButton, inkButton } from "./surfaces";
import { cn } from "./internal/utils";

/** An untitled conversation is one the first turn hasn't named yet. */
function labelOf(session: AppAgentSessionType): string {
  return session.title?.trim() || "New chat";
}

interface SessionListProps {
  sessions: AppAgentSessionType[];
  activeId?: string;
  onPick: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function AppAgentSessionList({
  sessions,
  activeId,
  onPick,
  onRename,
  onDelete,
  className,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const commit = () => {
    if (!editingId) return;
    const next = draft.trim();
    // An empty rename is a cancel, not a way to blank the label.
    if (next) onRename(editingId, next);
    setEditingId(null);
  };

  return (
    <nav
      aria-label="Conversations"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto",
        className,
      )}
    >
      {sessions.map((session) => {
        const isActive = session.id === activeId;
        const isEditing = session.id === editingId;
        const isConfirming = session.id === confirmId;

        return (
          <div
            key={session.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs",
              isActive ? "bg-foreground/[0.07]" : fieldInteractive,
              !isActive && "bg-transparent",
            )}
          >
            {isEditing ? (
              <>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={commit}
                  aria-label="Conversation name"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                />
                <button
                  type="button"
                  aria-label="Save name"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commit}
                  className={cn(ghostButton, "size-6")}
                >
                  <CheckIcon className="size-3" aria-hidden="true" />
                </button>
              </>
            ) : isConfirming ? (
              <>
                <span className="min-w-0 flex-1 truncate">Delete?</span>
                <button
                  type="button"
                  aria-label="Confirm delete"
                  onClick={() => {
                    setConfirmId(null);
                    onDelete(session.id);
                  }}
                  className={cn(ghostButton, "text-destructive size-6")}
                >
                  <CheckIcon className="size-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel delete"
                  onClick={() => setConfirmId(null)}
                  className={cn(ghostButton, "size-6")}
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onPick(session.id)}
                  onDoubleClick={() => {
                    setDraft(session.title ?? "");
                    setEditingId(session.id);
                  }}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  {labelOf(session)}
                </button>
                {/* Revealed on hover/focus, but never hidden from keyboards. */}
                <button
                  type="button"
                  aria-label={`Rename ${labelOf(session)}`}
                  onClick={() => {
                    setDraft(session.title ?? "");
                    setEditingId(session.id);
                  }}
                  className={cn(
                    ghostButton,
                    "size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <PencilIcon className="size-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${labelOf(session)}`}
                  onClick={() => setConfirmId(session.id)}
                  className={cn(
                    ghostButton,
                    "size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <Trash2Icon className="size-3" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        );
      })}

      {!sessions.length ? (
        <p className="text-foreground/40 px-2 py-1.5 text-xs">
          No conversations yet.
        </p>
      ) : null}
    </nav>
  );
}

/** The conversation sidebar, shown when the assistant is expanded to full page. */
export function AppAgentSessions({
  busy,
  onCreate,
  ...list
}: SessionListProps & { busy: boolean; onCreate: () => void }) {
  return (
    <aside className="border-foreground/[0.06] flex w-56 shrink-0 flex-col gap-1 border-r p-2">
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className={cn(
          inkButton,
          "mb-1 flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-medium disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        <PlusIcon className="size-3.5" aria-hidden="true" />
        New chat
      </button>

      <AppAgentSessionList {...list} />
    </aside>
  );
}

/**
 * The same conversation list, as a popover for the forms with no room for a
 * sidebar. Sits INSIDE the panel rather than escaping it — the floating panel
 * clips its overflow, so an anchored dropdown would be cut off.
 */
export function AppAgentHistory({
  onDismiss,
  triggerRef,
  ...list
}: SessionListProps & {
  onDismiss: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      // The trigger toggles on click. Treating its mousedown as an outside
      // click would close here and let the click reopen immediately.
      if (triggerRef.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onDismiss, triggerRef]);

  return (
    <div
      ref={ref}
      className={cn(
        floating,
        // The shadow separates it in light mode; on the panel's own dark surface a
        // dark shadow is invisible, so the hairline is what carries dark.
        "border-foreground/[0.12] absolute end-2.5 top-13 z-20 flex max-h-64 w-64 flex-col overflow-hidden rounded-2xl border",
      )}
    >
      <p className="text-foreground/40 px-3 pt-2.5 pb-1 text-[11px] font-medium">
        Conversations
      </p>
      <AppAgentSessionList {...list} className="p-1.5 pt-0" />
    </div>
  );
}
