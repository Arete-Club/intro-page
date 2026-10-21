/** Optional, one-time body reveals. Content is visible without this module. */
export function mountEditorial(root: HTMLElement): () => void {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || typeof IntersectionObserver !== 'function' || typeof Element.prototype.animate !== 'function') return () => {};

  const pending = new Set(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  const active = new Map<HTMLElement, Animation>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const block = entry.target as HTMLElement;
      if (!entry.isIntersecting || !pending.has(block)) continue;
      pending.delete(block);
      observer.unobserve(block);
      if (motion.matches || block.contains(document.activeElement)) continue;
      // No persistent hidden style or fill: failure/cancellation restores the HTML state.
      const animation = block.animate([
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 560, delay: block.dataset.reveal === 'detail' ? 60 : 0, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
      active.set(block, animation);
      animation.finished.then(() => active.delete(block), () => active.delete(block));
    }
  }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });

  const show = (target: Element) => {
    for (const block of pending) {
      if (!target.contains(block) && !block.contains(target)) continue;
      pending.delete(block);
      observer.unobserve(block);
    }
    for (const [block, animation] of active) {
      if (!target.contains(block) && !block.contains(target)) continue;
      animation.cancel();
      active.delete(block);
    }
  };
  const showHash = () => {
    // Match the browser's target instead of parsing arbitrary fragments as selectors.
    const target = document.querySelector(':target');
    if (target) show(target);
  };
  const onClick = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link || link.origin !== location.origin || link.pathname !== location.pathname || link.search !== location.search || !link.hash) return;
    // All current in-page anchors use plain section IDs.
    const target = document.getElementById(link.hash.slice(1));
    if (target) show(target);
  };
  const onFocus = (event: FocusEvent) => {
    if (event.target instanceof Element) show(event.target);
  };
  const cleanup = () => {
    observer.disconnect();
    pending.clear();
    for (const animation of active.values()) animation.cancel();
    active.clear();
    document.removeEventListener('click', onClick);
    root.removeEventListener('focusin', onFocus);
    window.removeEventListener('hashchange', showHash);
    window.removeEventListener('pagehide', onPageHide);
    motion.removeEventListener('change', onMotionChange);
  };
  const onMotionChange = () => { if (motion.matches) cleanup(); };
  const onPageHide = (event: PageTransitionEvent) => {
    // Keep the observer for back/forward-cache restores; finish any visible motion.
    if (event.persisted) show(root);
    else cleanup();
  };

  showHash();
  for (const block of pending) {
    const box = block.getBoundingClientRect();
    // Do not fade out already-visible content on load or history restoration.
    if (box.top < innerHeight && box.bottom > 0) pending.delete(block);
    else observer.observe(block);
  }
  document.addEventListener('click', onClick);
  root.addEventListener('focusin', onFocus);
  window.addEventListener('hashchange', showHash);
  window.addEventListener('pagehide', onPageHide);
  motion.addEventListener('change', onMotionChange);
  return cleanup;
}
