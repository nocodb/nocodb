// Platform-owned — restored every turn. Never edit.
//
// Assistant replies are markdown: models emit it by default, and lists, bold and
// tables genuinely help. Rendering it as literal text showed the syntax instead.
//
// Streamdown rather than a plain markdown renderer because this text arrives
// MID-STREAM: it closes unterminated code fences, half-written tables and
// dangling emphasis while they are still being typed, so the panel doesn't
// flicker between broken and fixed on every token.
//
// LAZY on purpose. Streamdown carries shiki's grammars — around 135kB gzipped —
// and `AppAgent` is mounted in every published app, including the ones whose
// assistant is switched off. A static import would bill every app for a feature
// most of them never render. Behind `lazy`, the chunk is fetched the first time
// an assistant message actually needs it, and the fallback below means the text
// is readable (just unformatted) for the moment that takes.
import { lazy, Suspense } from "react";

const AgentMarkdownRender = lazy(
  () => import("../elements/agent-markdown-render"),
);

export function AgentMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap">
          {children}
        </div>
      }
    >
      <AgentMarkdownRender className={className}>{children}</AgentMarkdownRender>
    </Suspense>
  );
}
