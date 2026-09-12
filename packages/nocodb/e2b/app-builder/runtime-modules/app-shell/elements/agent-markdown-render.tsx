// Platform-owned — restored every turn. Never edit.
//
// The actual Streamdown renderer, kept in its own module so `agent-markdown`
// can load it lazily — see that file for why the split exists.
import { Streamdown } from "streamdown";
import { cn } from "../internal/utils";

export default function AgentMarkdownRender({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Streamdown
      // The whole point: complete the syntax the stream hasn't finished yet.
      parseIncompleteMarkdown
      // Model output is untrusted text rendered inside the app's own page.
      // Streamdown sanitises by default; this drops raw HTML entirely, so a
      // reply can only ever produce markdown's own elements. (`allowedTags` is
      // NOT a restriction — it ADDS custom tags to the sanitiser — so it is
      // deliberately not used here.)
      skipHtml
      // A chat panel beside an app is narrow: copy/download chrome on every code
      // block and table costs more room than it earns.
      controls={false}
      className={cn(
        // Tight prose: headings sized down to sit inside a panel rather than
        // shout, and lists/tables kept scrollable instead of forcing the column
        // wider than the reading measure.
        "text-[13.5px] leading-relaxed",
        "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:ps-5",
        "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:ps-5",
        "[&_li]:my-0.5",
        "[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-[15px] [&_h1]:font-semibold",
        "[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-[14px] [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-[13.5px] [&_h3]:font-semibold",
        "[&_code]:rounded [&_code]:bg-foreground/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:text-[12px]",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:border-foreground/15 [&_blockquote]:my-2 [&_blockquote]:border-s-2 [&_blockquote]:ps-3",
        "[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-[12px]",
        "[&_th]:border-foreground/10 [&_th]:border-b [&_th]:px-2 [&_th]:py-1 [&_th]:text-start [&_th]:font-medium",
        "[&_td]:border-foreground/[0.06] [&_td]:border-b [&_td]:px-2 [&_td]:py-1",
        "[&_hr]:border-foreground/10 [&_hr]:my-3",
        className,
      )}
    >
      {children}
    </Streamdown>
  );
}
