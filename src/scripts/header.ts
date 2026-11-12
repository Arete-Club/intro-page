export type HeaderState = 'surface' | 'scene' | 'solid';

/**
 * Fixed header look (SPEC N02–N03), from what lies under it:
 * - `surface`: the bright sky/sea; clear, navy ink.
 * - `scene`: the pinned underwater scene; clear, light ink over its top shade.
 * - `solid`: body content or a navy panel; translucent navy bar, light ink.
 */
export function headerState(pinned: boolean, regionBottom: number, headerHeight: number, ink?: string): HeaderState {
  if (regionBottom <= headerHeight) return 'solid';
  return pinned && ink === 'light' ? 'scene' : 'surface';
}

/** Keeps `data-state` on the header in step with scroll and the ocean's layout. Without this, CSS shows `solid`. */
export function mountHeader(header: HTMLElement, ocean: HTMLElement): () => void {
  const stage = ocean.querySelector<HTMLElement>('.ocean-stage');
  const hero = ocean.querySelector<HTMLElement>('.hero-copy');
  if (!stage || !hero) return () => {};
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Scroll events arrive before the ocean's frame writes styles, so these reads stay cheap.
  const update = () => {
    // Cinematic layout pins a 100svh stage inside a taller section; the static one stacks
    // the panels, where only the sky-blue hero is bright.
    const pinned = ocean.offsetHeight > stage.offsetHeight;
    const region = pinned ? stage : hero;
    const state = headerState(pinned, region.getBoundingClientRect().bottom, header.offsetHeight, ocean.dataset.ink);
    if (header.dataset.state !== state) header.dataset.state = state;
  };
  // Layout switches with reduced motion and fallback; ink with the scene's depth.
  const observer = new MutationObserver(update);
  observer.observe(ocean, { attributes: true, attributeFilter: ['data-scene', 'data-ink'] });
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  motion.addEventListener('change', update);
  update();
  return () => {
    observer.disconnect();
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    motion.removeEventListener('change', update);
  };
}
