'use client';

import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';

interface ScrollableMainContentProps {
  id: string;
  children: ReactNode;
  contentClassName?: string;
}

/**
 * ScrollableMainContent
 *
 * Wraps the main workspace content area in a flex container that monitors vertical
 * scrolling. When additional content is available below the visible viewport, a
 * subtle bottom blur/fade indicator is displayed at the bottom edge of the container.
 * When the user reaches the bottom (or if the content is not scrollable), the blur
 * smoothly transitions to opacity 0.
 */
export function ScrollableMainContent({
  id,
  children,
  contentClassName = 'mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8 xl:p-8',
}: ScrollableMainContentProps) {
  const scrollRef = useRef<HTMLElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const isScrollable = scrollHeight > clientHeight + 4;
    const isNearBottom = scrollHeight - scrollTop - clientHeight <= 10;
    setCanScrollDown(isScrollable && !isNearBottom);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkScroll();
      });
      resizeObserver.observe(el);
      if (el.firstElementChild) {
        resizeObserver.observe(el.firstElementChild);
      }
    }

    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [checkScroll]);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-transparent">
      <main
        ref={scrollRef}
        id={id}
        tabIndex={-1}
        className="flex-1 min-h-0 overflow-y-auto outline-none"
      >
        <div className={contentClassName}>{children}</div>
      </main>

      {/* Subtle bottom blur/fade effect */}
      <div
        aria-hidden="true"
        className={`wp-bottom-blur-fade ${canScrollDown ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
