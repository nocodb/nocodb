"use client";

import type { ComponentProps } from "react";
import { ArrowUpIcon } from "lucide-react";
import { cn } from "../internal/utils";
import { field, inkButton, paper } from "../surfaces";

export function ChatPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-panel"
      className={cn(
        paper,
        "flex h-[270px] w-full max-w-md flex-col overflow-hidden rounded-[24px]",
        className,
      )}
      {...props}
    />
  );
}

export function ChatPanelMessages({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-panel-messages"
      className={cn(
        "flex flex-1 flex-col justify-end gap-2.5 overflow-y-auto p-4",
        className,
      )}
      {...props}
    />
  );
}

export function ChatPanelUserMessage({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-panel-user-message"
      className={cn(
        field,
        "fade-in slide-in-from-bottom-1 animate-in self-end rounded-2xl px-3 py-1.5 text-xs duration-300",
        className,
      )}
      {...props}
    />
  );
}

export function ChatPanelAssistantMessage({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      data-slot="chat-panel-assistant-message"
      className={cn(
        "text-foreground/70 max-w-[85%] self-start text-xs leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export function ChatPanelTyping({
  className,
  ...props
}: Omit<ComponentProps<"div">, "children">) {
  return (
    <div
      data-slot="chat-panel-typing"
      className={cn(
        "fade-in animate-in flex gap-1 self-start px-1 duration-300",
        className,
      )}
      {...props}
    >
      {["-0.32s", "-0.16s", "0s"].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="bg-foreground/40 size-1 animate-bounce rounded-full motion-reduce:animate-none"
          style={{ animationDelay: delay, animationDuration: "1.1s" }}
        />
      ))}
    </div>
  );
}

export function ChatPanelComposer({
  placeholder,
  onSend,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "placeholder"> & {
  placeholder: string;
  onSend?: () => void;
}) {
  return (
    <div
      data-slot="chat-panel-composer"
      className={cn(
        field,
        "mx-3 mb-3 flex h-10 shrink-0 items-center justify-between rounded-full py-1.5 ps-4 pe-1.5",
        className,
      )}
      {...props}
    >
      <span className="text-foreground/35 text-[13px]">{placeholder}</span>
      <button
        type="button"
        aria-label="Send"
        onClick={onSend}
        disabled={!onSend}
        className={cn(
          inkButton,
          "flex size-7 items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <ArrowUpIcon className="size-3.5" />
      </button>
    </div>
  );
}
