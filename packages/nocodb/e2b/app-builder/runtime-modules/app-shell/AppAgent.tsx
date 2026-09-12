// Platform-owned — restored every turn. Never edit.
//
// The in-app assistant. Every published app gets it; the app writes no code for
// it. It renders nothing at all unless the console has enabled an assistant AND
// this particular caller's App Team is allowed one — both decided server-side,
// so an app cannot show a widget its viewer may not use.
//
// The assistant's tools are this app's own actions, narrowed to what THIS caller
// is granted. Every call — writes included — runs immediately: dispatch already
// re-checks the caller's capability grant on each one, so a per-call
// confirmation only re-asked what the person was already allowed to do, and made
// bulk work ("add some dummy records") a wall of prompts.
//
// Built from the assistant-ui elements vendored in `components/elements/*`,
// which style themselves from the app's own theme tokens (bg-background,
// text-foreground), so the widget follows whatever preset the app is on.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  APP_AGENT_MAX_MESSAGE,
  AppAgentMode,
  AppAgentToolStatus,
  createAgentSession,
  deleteAgentSession,
  loadAgentMessages,
  loadAgentSession,
  renameAgentSession,
  sendAgentTurn,
  stopAgentTurn,
  watchAgentTurn,
  type AgentStreamHandle,
  type AppAgentContentBlock,
  type AppAgentMessageType,
  type AppAgentSessionType,
} from "@nocodb/app-ctx/agent";
import { ctx } from "@nocodb/app-ctx";
import { AppAgentHistory, AppAgentSessions } from "./AppAgentSessions";
import { setAgentInset } from "./agentShell";
import {
  ArrowUpIcon,
  HistoryIcon,
  MaximizeIcon,
  MessageCircleIcon,
  MinimizeIcon,
  PanelRightIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import {
  ChatPanel,
  ChatPanelMessages,
  ChatPanelTyping,
  ChatPanelUserMessage,
} from "./elements/chat-panel";
import {
  EmptyState,
  EmptyStateGreeting,
  EmptyStateSuggestion,
  EmptyStateSuggestions,
} from "./elements/empty-state";
import { AgentMarkdown } from "./elements/agent-markdown";
import { ErrorState } from "./elements/error-state";
import { ToolSteps, type ToolStepItem } from "./elements/tool-steps";
import { field, floating, floatingShadow, ghostButton, inkButton, pressable } from "./surfaces";
import { cn } from "./internal/utils";

interface AgentState {
  enabled: boolean;
  title: string;
  greeting?: string;
  starters: string[];
  mode: AppAgentMode;
  sessions: AppAgentSessionType[];
  sessionId?: string;
  messages: AppAgentMessageType[];
}

const EMPTY: AgentState = {
  enabled: false,
  title: "Assistant",
  starters: [],
  mode: AppAgentMode.FAB,
  sessions: [],
  messages: [],
};

/**
 * How the assistant is showing right now. The author picks the starting mode in
 * the console; this is the viewer's own override, remembered per app.
 *
 * `full` is the expanded form and the only one that shows the conversation
 * sidebar, because it is the only one with room for it.
 */
type Presentation = "fab" | "pane" | "full";

const PRESENTATION_KEY = "nc_agent_presentation";

/** Where a maximize came from, so exiting it returns there. */
const RESTORE_KEY = "nc_agent_restore";

type Restorable = Exclude<Presentation, "full">;

function storedPresentation(): Presentation | null {
  const raw = ctx.storage.get(PRESENTATION_KEY);
  return raw === "fab" || raw === "pane" || raw === "full" ? raw : null;
}

function storedRestore(): Restorable {
  return ctx.storage.get(RESTORE_KEY) === "pane" ? "pane" : "fab";
}

/** The draft assistant message a turn streams into, before it is persisted. */
const LIVE_ID = "__live__";

function textOf(parts: AppAgentContentBlock[] | undefined): string {
  return (parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * A readable name for a step.
 *
 * Falls back to humanising the dotted id rather than printing it: an id is
 * machinery, and the person chatting has a booking system, not a set of actions.
 */
function stepLabel(block: Extract<AppAgentContentBlock, { type: "tool" }>) {
  if (block.label) return block.label;
  const tail = block.actionId.split(".").pop() ?? block.actionId;
  const words = tail.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A step, as the person chatting sees it: what it was, and what went wrong.
 *
 * Never the input or the output. This widget is the app's own end customers, not
 * its author — arguments and payloads are the machinery underneath a booking
 * they asked for, and printing them turns an answer into a log.
 */
function toStep(
  block: Extract<AppAgentContentBlock, { type: "tool" }>,
): ToolStepItem {
  return {
    id: block.id,
    label: stepLabel(block),
    status: block.status,
    error: block.error,
  };
}

type Segment =
  | { kind: "text"; key: string; text: string }
  | { kind: "tools"; key: string; steps: ToolStepItem[] }
  | { kind: "error"; key: string; message: string };

/**
 * The parts of one message IN THE ORDER the model produced them, with each run
 * of consecutive steps folded into a single group.
 *
 * Order is the point. A turn that narrates between two calls has its narration
 * BETWEEN them, so rendering every text block first lifts a sentence above the
 * steps it introduces. Consecutive text merges back together because a
 * paragraph split by a tool call is still one paragraph.
 */
function segmentsOf(parts: AppAgentContentBlock[]): Segment[] {
  const out: Segment[] = [];
  parts.forEach((part, i) => {
    const last = out[out.length - 1];
    if (part.type === "text") {
      if (last?.kind === "text") last.text += part.text;
      else out.push({ kind: "text", key: `t${i}`, text: part.text });
    } else if (part.type === "tool") {
      if (last?.kind === "tools") last.steps.push(toStep(part));
      else out.push({ kind: "tools", key: `s${i}`, steps: [toStep(part)] });
    } else {
      out.push({ kind: "error", key: `e${i}`, message: part.message });
    }
  });
  return out;
}

function AgentMessage({
  message,
  onRetry,
  busy,
}: {
  message: AppAgentMessageType;
  onRetry: () => void;
  busy: boolean;
}) {
  if (message.role === "user") {
    const text = message.content || textOf(message.parts);
    return text ? (
      <ChatPanelUserMessage className="max-w-[68ch] text-[13.5px]">
        {text}
      </ChatPanelUserMessage>
    ) : null;
  }

  // `content` is the server's own join of the text blocks in `parts`, so parts
  // win wherever they exist and nothing is lost by preferring them.
  const segments = message.parts?.length
    ? segmentsOf(message.parts)
    : message.content
      ? [{ kind: "text" as const, key: "c", text: message.content }]
      : [];

  return (
    <>
      {segments.map((seg) =>
        seg.kind === "tools" ? (
          <ToolSteps key={seg.key} steps={seg.steps} />
        ) : seg.kind === "error" ? (
          <ErrorState
            key={seg.key}
            className="self-start"
            title="Something went wrong"
            detail={seg.message}
            retrying={busy}
            onRetry={onRetry}
          />
        ) : seg.text.trim() ? (
          <div
            key={seg.key}
            data-slot="chat-panel-assistant-message"
            className="text-foreground/80 max-w-[68ch] min-w-0 self-start"
          >
            <AgentMarkdown>{seg.text}</AgentMarkdown>
          </div>
        ) : null,
      )}
    </>
  );
}

export default function AppAgent() {
  const [state, setState] = useState<AgentState>(EMPTY);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<AppAgentContentBlock[] | null>(null);
  /** null until bootstrap resolves the author's default vs the stored override. */
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  /** The conversation list, in the forms with no room for a sidebar. */
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);

  const restoreFrom = useRef<Restorable>(storedRestore());

  const streamRef = useRef<AgentStreamHandle | null>(null);
  /** The turn being watched, so Stop can name it to the server. */
  const turnRef = useRef<string | null>(null);
  /** Latest state for callbacks that must not close over a stale session id. */
  const stateRef = useRef<AgentState>(EMPTY);
  /** Last instruction sent, so ErrorState can offer a real retry. */
  const lastSentRef = useRef("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const attach = useCallback((turnId: string) => {
    streamRef.current?.close();
    turnRef.current = turnId;

    const blocks: AppAgentContentBlock[] = [];
    setLive(blocks.slice());

    streamRef.current = watchAgentTurn(turnId, {
      onEvent: (event) => {
        if (event.type === "text_delta") {
          const last = blocks[blocks.length - 1];
          if (last?.type === "text") last.text += event.delta;
          else blocks.push({ type: "text", text: event.delta });
        } else if (event.type === "tool_start") {
          blocks.push({
            type: "tool",
            id: event.id,
            actionId: event.actionId,
            label: event.label,
            status: AppAgentToolStatus.RUNNING,
            input: event.input,
          });
        } else if (event.type === "tool_end") {
          const block = blocks.find(
            (b) => b.type === "tool" && b.id === event.id,
          );
          if (block?.type === "tool") {
            block.status = event.status;
            block.output = event.output;
            block.error = event.error;
          }
        } else if (event.type === "error") {
          blocks.push({ type: "error", message: event.message });
        } else if (event.type === "turn_end") {
          setBusy(false);
          turnRef.current = null;
          // No row was created — the turn ended before the model was reached
          // (no provider, no credits). The error frame is already in `live`, so
          // keep it on screen instead of clearing it away.
          if (!event.messageId) return;

          // The server's own record replaces the streamed draft — it is
          // authoritative, and a later reload must render the same thing.
          //
          // REPLACE by id, never append: the assistant row is inserted before
          // streaming starts and rewritten as it goes, so a client that
          // reattached mid-turn (a reload, or picking a thread streaming in
          // another tab) already has this exact row from bootstrap.
          const persisted: AppAgentMessageType = {
            id: event.messageId,
            role: "assistant",
            parts: event.parts,
          };
          setState((s) => {
            const known = s.messages.some((m) => m.id === persisted.id);
            return {
              ...s,
              messages: known
                ? s.messages.map((m) =>
                    m.id === persisted.id ? { ...m, ...persisted } : m,
                  )
                : [...s.messages, persisted],
            };
          });
          setLive(null);
          return;
        }
        setLive(blocks.slice());
      },
      onClose: () => setBusy(false),
      onError: () => setBusy(false),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAgentSession().then((res) => {
      if (cancelled) return;
      const mode = res.config.mode ?? AppAgentMode.FAB;
      setState({
        enabled: res.enabled,
        title: res.config.title || "Assistant",
        greeting: res.config.greeting,
        starters: res.config.starters ?? [],
        mode,
        sessions: res.sessions,
        sessionId: res.session?.id,
        messages: res.messages,
      });
      // The viewer's own choice wins over the author's default; a pane app
      // opens docked, a fab app opens closed.
      setPresentation(storedPresentation() ?? (mode === AppAgentMode.PANE ? "pane" : "fab"));
      // A turn that outlived the page — reattach rather than showing an idle
      // panel while the server is still working.
      if (res.activeTurnId) {
        setBusy(true);
        attach(res.activeTurnId);
      }
    });
    return () => {
      cancelled = true;
      streamRef.current?.close();
    };
  }, [attach]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Docked reflows the app; floating and full-page do not (full-page covers it).
  useEffect(() => {
    if (!state.enabled || !presentation) return;
    setAgentInset(presentation === "pane");
    return () => setAgentInset(false);
  }, [presentation, state.enabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [state.messages, live]);

  // Escape closes the panel. Closing only hides it — the turn keeps running and
  // is picked back up on reopen, so this is never a way to lose work.
  useEffect(() => {
    if (!open && !historyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Innermost layer first: dismissing the conversation list must not also
      // dismiss the assistant underneath it.
      if (historyOpen) setHistoryOpen(false);
      else if (open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen, open]);

  const send = useCallback(
    async (message: string) => {
      if (busy) return;
      setBusy(true);
      setInput("");

      if (message.trim()) {
        lastSentRef.current = message;
        setState((s) => ({
          ...s,
          messages: [
            ...s.messages,
            {
              id: `${LIVE_ID}${s.messages.length}`,
              role: "user",
              content: message,
            },
          ],
        }));
      }

      try {
        const res = await sendAgentTurn({
          message,
          sessionId: stateRef.current.sessionId,
        });
        // A first turn creates the conversation and names it; adopt both so the
        // sidebar updates without a refetch.
        setState((s) => {
          const known = s.sessions.some((x) => x.id === res.sessionId);
          const sessions = known
            ? s.sessions.map((x) =>
                x.id === res.sessionId && res.title
                  ? { ...x, title: res.title }
                  : x,
              )
            : [{ id: res.sessionId, title: res.title }, ...s.sessions];
          return { ...s, sessionId: res.sessionId, sessions };
        });
        attach(res.turnId);
      } catch (e) {
        setBusy(false);
        setLive([
          {
            type: "error",
            message:
              e instanceof Error ? e.message : "The assistant is unavailable.",
          },
        ]);
      }
    },
    [attach, busy],
  );

  const retry = useCallback(() => {
    const last = lastSentRef.current.trim();
    if (!last || busy) return;
    setLive(null);
    void send(last);
  }, [busy, send]);

  /** Switch conversations. The open stream belongs to the old one. */
  const pickSession = useCallback(async (sessionId: string) => {
    setHistoryOpen(false);
    if (sessionId === stateRef.current.sessionId) return;
    streamRef.current?.close();
    turnRef.current = null;
    setLive(null);
    setBusy(false);

    const res = await loadAgentMessages(sessionId).catch(() => null);
    if (!res) return;

    setState((s) => ({
      ...s,
      sessionId: res.session.id,
      messages: res.messages,
      sessions: s.sessions.map((x) =>
        x.id === res.session.id ? { ...x, ...res.session } : x,
      ),
    }));
    // That conversation may still be mid-turn from another tab.
    if (res.activeTurnId) {
      setBusy(true);
      attach(res.activeTurnId);
    }
  }, [attach]);

  /**
   * Start a new conversation. Created eagerly so it can be renamed before the
   * first message; the first turn then names it automatically if untouched.
   */
  const newSession = useCallback(() => {
    setHistoryOpen(false);
    streamRef.current?.close();
    turnRef.current = null;
    setLive(null);
    setBusy(false);
    // No id: the next turn creates the conversation and names it. Nothing is
    // written until the person actually says something, so an abandoned "New
    // chat" leaves no empty row behind.
    setState((s) => ({ ...s, sessionId: undefined, messages: [] }));
    setInput("");
  }, []);

  const renameSession = useCallback((sessionId: string, title: string) => {
    // Optimistic: the sidebar is the only reader, and a failed rename is
    // recoverable by trying again.
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((x) =>
        x.id === sessionId ? { ...x, title } : x,
      ),
    }));
    void renameAgentSession(sessionId, title).catch(() => undefined);
  }, []);

  const removeSession = useCallback(
    async (sessionId: string) => {
      await deleteAgentSession(sessionId).catch(() => undefined);
      const remaining = stateRef.current.sessions.filter(
        (x) => x.id !== sessionId,
      );
      const wasActive = stateRef.current.sessionId === sessionId;
      setState((s) => ({
        ...s,
        sessions: remaining,
        ...(wasActive
          ? { sessionId: remaining[0]?.id, messages: [] }
          : {}),
      }));
      // Deleting the open conversation drops you into the next one.
      if (wasActive && remaining[0]) void pickSession(remaining[0].id);
    },
    [pickSession],
  );

  /**
   * Stop the current turn.
   *
   * Asks the server to abort the model call — the turn really stops, rather than
   * running on unwatched — and keeps the stream attached so the terminal frame
   * still lands and whatever was generated is kept as the answer.
   */
  const stop = useCallback(() => {
    const turnId = turnRef.current;
    if (!turnId) {
      setBusy(false);
      return;
    }
    // `busy` stays set until the terminal frame lands, which is now moments away:
    // the server only allows one turn per conversation, so unlocking the composer
    // early lets the next message race the abort and come back a 429. If there
    // was nothing left to stop, nothing else will unlock it — so do it here.
    void stopAgentTurn(turnId)
      .then((res) => {
        if (!res?.stopped) setBusy(false);
      })
      .catch(() => setBusy(false));
  }, []);

  // Stable: the popover subscribes a document listener to it, and this component
  // re-renders on every streamed token.
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  const setMode = useCallback((next: Presentation) => {
    // The anchor moves with the form, and full page has the sidebar instead.
    setHistoryOpen(false);
    setPresentation(next);
    ctx.storage.set(PRESENTATION_KEY, next);
    if (next !== "full") {
      restoreFrom.current = next;
      ctx.storage.set(RESTORE_KEY, next);
    }
  }, []);

  // Full page is a temporary state on top of whichever form it was opened from:
  // maximizing a floating panel and minimizing it again has to give the panel
  // back, not dock it to the side.
  const toggleFull = useCallback(() => {
    setMode(presentation === "full" ? restoreFrom.current : "full");
  }, [presentation, setMode]);

  if (!state.enabled || !presentation) return null;

  const isEmpty = !state.messages.length && !live;
  const isPane = presentation === "pane";
  const isFull = presentation === "full";
  const isOpen = isPane || isFull || open;

  const header = (
    <header className="flex shrink-0 items-center justify-between gap-2 py-2.5 pr-2.5 pl-4">
      <h2 className="min-w-0 truncate text-[13.5px] font-medium">
        {state.title}
      </h2>
      <div className="flex shrink-0 items-center gap-1">
        {/* Full page has the sidebar; these are how the compact forms reach it. */}
        {!isFull ? (
          <>
            <button
              type="button"
              aria-label="New chat"
              disabled={busy}
              onClick={newSession}
              className={cn(
                ghostButton,
                "size-8 disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <PlusIcon className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              ref={historyTriggerRef}
              aria-label="Conversations"
              aria-haspopup="true"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((v) => !v)}
              className={cn(ghostButton, "size-8")}
            >
              <HistoryIcon className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : null}
        {/* Dock / undock. In FAB form this is how you pin it open. */}
        <button
          type="button"
          aria-label={isPane ? "Detach assistant" : "Dock assistant to the side"}
          aria-pressed={isPane}
          onClick={() => setMode(isPane ? "fab" : "pane")}
          className={cn(ghostButton, "size-8")}
        >
          <PanelRightIcon className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={isFull ? "Exit full page" : "Expand to full page"}
          onClick={toggleFull}
          className={cn(ghostButton, "size-8")}
        >
          {isFull ? (
            <MinimizeIcon className="size-4" aria-hidden="true" />
          ) : (
            <MaximizeIcon className="size-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="Close assistant"
          onClick={() => {
            // Closing a docked pane returns the app to full width; closing a
            // floating panel just hides it.
            if (isPane || isFull) setMode("fab");
            setHistoryOpen(false);
            setOpen(false);
          }}
          className={cn(ghostButton, "size-8")}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );

  const history = historyOpen ? (
    <AppAgentHistory
      sessions={state.sessions}
      activeId={state.sessionId}
      onPick={(id) => void pickSession(id)}
      onRename={renameSession}
      onDelete={(id) => void removeSession(id)}
      onDismiss={closeHistory}
      triggerRef={historyTriggerRef}
    />
  ) : null;

  const conversation = (
    <>
      <ChatPanelMessages className="mx-auto w-full max-w-3xl justify-start gap-3">
        {isEmpty ? (
          <EmptyState className="my-auto">
            <EmptyStateGreeting className="text-lg">
              {state.greeting ?? "How can I help?"}
            </EmptyStateGreeting>
            {state.starters.length ? (
              <EmptyStateSuggestions>
                {state.starters.map((s, i) => (
                  <EmptyStateSuggestion
                    key={s}
                    index={i}
                    onClick={() => void send(s)}
                  >
                    {s}
                  </EmptyStateSuggestion>
                ))}
              </EmptyStateSuggestions>
            ) : null}
          </EmptyState>
        ) : null}

        {state.messages.map((m) => (
          <AgentMessage
            key={m.id}
            message={m}
            onRetry={retry}
            busy={busy}
          />
        ))}

        {live ? (
          <AgentMessage
            message={{ id: LIVE_ID, role: "assistant", parts: live }}
            onRetry={retry}
            busy={busy}
          />
        ) : null}

        {busy && !live ? <ChatPanelTyping /> : null}

        <div ref={bottomRef} />
      </ChatPanelMessages>

      <form
        className={cn(
          field,
          "mx-auto mb-3 flex w-[calc(100%-1.5rem)] max-w-3xl shrink-0 items-end gap-1.5 rounded-[20px] py-1.5 ps-3 pe-1.5",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) void send(input);
        }}
      >
        <label htmlFor="nc-agent-input" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="nc-agent-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything…"
          rows={1}
          maxLength={APP_AGENT_MAX_MESSAGE}
          className="placeholder:text-foreground/35 max-h-28 min-h-7 flex-1 resize-none bg-transparent py-1 text-[13px] outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim()) void send(input);
            }
          }}
        />
        {busy ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={stop}
            className={cn(
              inkButton,
              "flex size-8 shrink-0 items-center justify-center rounded-full",
            )}
          >
            <SquareIcon className="size-3 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send message"
            disabled={!input.trim()}
            className={cn(
              inkButton,
              "flex size-8 shrink-0 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-30",
            )}
          >
            <ArrowUpIcon className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </form>
    </>
  );

  // FULL PAGE — the only form with room for the conversation sidebar.
  if (isFull) {
    return (
      <div className="bg-background fixed inset-0 z-50 flex">
        <AppAgentSessions
          sessions={state.sessions}
          activeId={state.sessionId}
          busy={busy}
          onPick={(id) => void pickSession(id)}
          onCreate={newSession}
          onRename={renameSession}
          onDelete={(id) => void removeSession(id)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {header}
          {conversation}
        </div>
      </div>
    );
  }

  // DOCKED PANE — from `sm` up the app is reflowed beside it by the shell in
  // main.tsx, which reads the same width from --nc-agent-inset. Below `sm` there
  // is no useful width to split, so the pane covers the app full-bleed and the
  // shell's inset is off (its padding is `sm:`-gated) — a 24rem pane on a 375px
  // viewport is wider than the screen.
  if (isPane) {
    return (
      <div className="border-foreground/[0.08] bg-background fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l sm:w-(--nc-agent-pane-width)">
        {header}
        {history}
        {conversation}
      </div>
    );
  }

  // FLOATING — a launcher and a compact panel.
  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${state.title}`}
          className={cn(
            inkButton,
            floatingShadow,
            pressable,
            // Right edge and rhythm shared with the server-injected "Made with
            // NocoDB" chip that sits below it (right 12px, ~26px tall): a 44px
            // pill at right-4 sat off-axis and towered over it.
            "fixed right-3 bottom-12 z-50 flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium",
          )}
        >
          <MessageCircleIcon className="size-4" aria-hidden="true" />
          {state.title || "Assistant"}
        </button>
      ) : (
        <ChatPanel
          className={cn(
            floating,
            "fixed inset-x-3 bottom-12 z-50 h-[min(32rem,calc(100dvh-6rem))] w-auto max-w-none sm:inset-x-auto sm:right-3 sm:w-96",
          )}
        >
          {header}
          {history}
          {conversation}
        </ChatPanel>
      )}
    </>
  );
}