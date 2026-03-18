import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBlock } from "./message-block";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "../lib/utils";
import type { NormalizedMessage, SessionTimeline } from "../../../shared/contracts";
import { useTraceStore } from "../stores/trace-store";
import { useSessionStore } from "../stores/session-store";

const SCROLL_THRESHOLD = 120;

interface ConversationViewProps {
  timeline?: SessionTimeline;
  rawMode?: boolean;
}

function isToolResultOnlyMessage(message: NormalizedMessage): boolean {
  return (
    message.blocks.length > 0 &&
    message.blocks.every((block) => block.type === "tool-result")
  );
}

function assignRoundNumbers(messages: NormalizedMessage[]) {
  let currentRound = 0;

  return messages.map((message) => {
    const startsNewRound =
      message.role === "user" && !isToolResultOnlyMessage(message);

    if (startsNewRound || (currentRound === 0 && message.role !== "system")) {
      currentRound += 1;
    }

    return {
      message,
      roundNumber: currentRound > 0 ? currentRound : null,
    };
  });
}

export function ConversationView({ timeline, rawMode }: ConversationViewProps) {
  const storeTrace = useTraceStore((state) => state.trace);
  const storeRawMode = useTraceStore((state) => state.rawMode);
  const messageOrder = useTraceStore((state) => state.messageOrder);
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId);
  const activeTimeline = timeline ?? storeTrace?.timeline ?? { messages: [] };
  const activeRawMode = rawMode ?? storeRawMode;
  const messages = activeTimeline.messages;
  const messagesWithRounds = assignRoundNumbers(messages);
  const displayMessages =
    messageOrder === "desc" ? [...messagesWithRounds].reverse() : messagesWithRounds;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const prevCountRef = useRef(messages.length);
  const scrollCache = useRef<Map<string, number>>(new Map());
  const prevSessionRef = useRef<string | null>(null);
  const scrollListenerAttached = useRef(false);

  const distanceFromLatest = useCallback((el: HTMLDivElement) => {
    if (messageOrder === "desc") {
      return el.scrollTop;
    }
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }, [messageOrder]);

  const updateButtons = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isScrollable = scrollHeight > clientHeight + 1;
    setShowTop(isScrollable && scrollTop > SCROLL_THRESHOLD);
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowBottom(isScrollable && distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  // Ref callback to setup scroll listener once
  const setViewportRef = useCallback((el: HTMLDivElement | null) => {
    // Cleanup old listener if ref changes
    if (viewportRef.current && scrollListenerAttached.current) {
      viewportRef.current.removeEventListener("scroll", handleScroll);
      scrollListenerAttached.current = false;
    }

    viewportRef.current = el;

    if (el && !scrollListenerAttached.current) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      scrollListenerAttached.current = true;
      requestAnimationFrame(updateButtons);
    }
  }, [updateButtons]);

  const handleScroll = useCallback(() => {
    updateButtons();
    const el = viewportRef.current;
    if (!el) return;
    if (distanceFromLatest(el) <= SCROLL_THRESHOLD) {
      setHasNew(false);
    }
  }, [distanceFromLatest, updateButtons]);

  // Save/restore scroll position on session switch
  useEffect(() => {
    const el = viewportRef.current;
    if (prevSessionRef.current && el) {
      scrollCache.current.set(
        `${prevSessionRef.current}:${messageOrder}`,
        el.scrollTop,
      );
    }
    if (selectedSessionId && el) {
      const saved = scrollCache.current.get(`${selectedSessionId}:${messageOrder}`);
      requestAnimationFrame(() => {
        el.scrollTo({
          top: saved ?? (messageOrder === "desc" ? 0 : 0),
        });
        updateButtons();
      });
    }
    prevSessionRef.current = selectedSessionId ?? null;
  }, [messageOrder, selectedSessionId, updateButtons]);

  // Recalculate buttons when content changes
  useEffect(() => {
    requestAnimationFrame(updateButtons);
  }, [displayMessages.length, messageOrder, updateButtons]);

  // Detect new messages while not at bottom
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const el = viewportRef.current;
      if (el) {
        if (distanceFromLatest(el) > SCROLL_THRESHOLD) {
          setHasNew(true);
        }
      }
    }
    prevCountRef.current = messages.length;
  }, [distanceFromLatest, messages.length]);

  // Watch for element size changes (visibility, content loading, etc.)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(() => {
      updateButtons();
    });
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [updateButtons]);

  const scrollToBottom = () => {
    const el = viewportRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight });
      if (messageOrder === "asc") {
        setHasNew(false);
      }
      requestAnimationFrame(updateButtons);
    }
  };

  const scrollToTop = () => {
    viewportRef.current?.scrollTo({ top: 0 });
    if (messageOrder === "desc") {
      setHasNew(false);
    }
    requestAnimationFrame(updateButtons);
  };

  if (displayMessages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No messages to display
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="h-full overflow-auto" ref={setViewportRef}>
        <div className="space-y-3 p-6 max-w-4xl mx-auto">
          {displayMessages.map(({ message, roundNumber }, i) => (
            <MessageBlock
              key={`msg-${i}`}
              message={message}
              roundNumber={roundNumber}
              rawMode={activeRawMode}
            />
          ))}
        </div>
      </div>

      {/* Scroll navigation */}
      {(showTop || showBottom) && (
        <div className="absolute bottom-3 right-4 z-10 flex flex-col gap-1">
          {showTop && (
            <button
              className="relative flex items-center justify-center h-7 w-7 bg-card border border-border shadow-sm hover:bg-accent transition-colors rounded-sm"
              onClick={scrollToTop}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              {hasNew && messageOrder === "desc" && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-brand animate-pulse" />
              )}
            </button>
          )}
          {showBottom && (
            <button
              className="relative flex items-center justify-center h-7 w-7 bg-card border border-border shadow-sm hover:bg-accent transition-colors rounded-sm"
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              {hasNew && messageOrder === "asc" && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-brand animate-pulse" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
