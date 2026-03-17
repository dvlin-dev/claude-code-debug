import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBlock } from "./message-block";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "../lib/utils";
import type { SessionTimeline } from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";

const SCROLL_THRESHOLD = 120;

interface ConversationViewProps {
  timeline?: SessionTimeline;
  rawMode?: boolean;
}

export function ConversationView({ timeline, rawMode }: ConversationViewProps) {
  const storeTrace = useTraceStore((state) => state.trace);
  const storeRawMode = useTraceStore((state) => state.rawMode);
  const activeTimeline = timeline ?? storeTrace?.timeline ?? { messages: [] };
  const activeRawMode = rawMode ?? storeRawMode;
  const messages = activeTimeline.messages;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const prevCountRef = useRef(messages.length);

  const updateButtons = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowTop(scrollTop > SCROLL_THRESHOLD);
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowBottom(distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  // Detect new messages while not at bottom
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const el = viewportRef.current;
      if (el) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom > SCROLL_THRESHOLD) {
          setHasNew(true);
        }
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Attach scroll listener to the viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onScroll = () => {
      updateButtons();
      // Clear new indicator when scrolled to bottom
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom <= SCROLL_THRESHOLD) {
        setHasNew(false);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    updateButtons();
    return () => el.removeEventListener("scroll", onScroll);
  }, [updateButtons]);

  // Grab the viewport element from radix ScrollArea
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const viewport = node.querySelector("[data-slot='scroll-area-viewport']");
      viewportRef.current = viewport as HTMLDivElement | null;
      updateButtons();
    }
  }, [updateButtons]);

  const scrollToTop = () => {
    viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setHasNew(false);
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No messages to display
      </div>
    );
  }

  return (
    <div className="relative h-full" ref={containerRef}>
      <div className="h-full overflow-auto" ref={(el) => { viewportRef.current = el; }}>
        <div className="space-y-3 p-6 max-w-4xl mx-auto">
          {messages.map((msg, i) => (
            <MessageBlock
              key={`msg-${i}`}
              message={msg}
              rawMode={activeRawMode}
            />
          ))}
        </div>
      </div>

      {/* Scroll to top */}
      {showTop && (
        <button
          className="absolute top-3 right-4 z-10 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-card border border-border shadow-sm hover:bg-accent transition-colors"
          onClick={scrollToTop}
        >
          <ArrowUp className="h-3 w-3" />
          Top
        </button>
      )}

      {/* Scroll to latest */}
      {showBottom && (
        <button
          className="absolute bottom-3 right-4 z-10 flex items-center gap-1 px-2.5 py-1.5 text-xs bg-card border border-border shadow-sm hover:bg-accent transition-colors"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-3 w-3" />
          Latest
          {hasNew && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent-brand animate-pulse" />
          )}
        </button>
      )}
    </div>
  );
}
