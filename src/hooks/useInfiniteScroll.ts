import { useEffect, useRef, useCallback } from "react";

// =============================================================
// useInfiniteScroll
// Attaches an IntersectionObserver to a sentinel element.
// When the sentinel enters the viewport, calls onLoadMore.
// Use the returned ref on a div at the bottom of your list.
//
// Usage:
//   const sentinelRef = useInfiniteScroll({ onLoadMore, hasMore, isLoading });
//   ...
//   <div ref={sentinelRef} />
// =============================================================

interface Options {
  onLoadMore: () => void;
  hasMore:    boolean;
  isLoading:  boolean;
  rootMargin?: string;
}

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  rootMargin = "200px",
}: Options) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const stableLoad = useCallback(onLoadMore, [onLoadMore]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          stableLoad();
        }
      },
      { rootMargin }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, stableLoad, rootMargin]);

  return sentinelRef;
}
