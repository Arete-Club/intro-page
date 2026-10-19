import { parseHex, rgbCSS } from './color';
import { oceanFrame, type CopyKey, type OceanFrame, type Palette } from './timeline';

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => parseHex(styles.getPropertyValue(name).trim());
  return {
    bg: token('--bg'),
    deep: token('--deep'),
    ocean: token('--ocean'),
    cyan: token('--cyan'),
    offWhite: token('--off-white'),
  };
}

export function mountOcean(ocean: HTMLElement) {
  const host = ocean.querySelector<HTMLElement>('.ocean-canvas');
  const stage = ocean.querySelector<HTMLElement>('.ocean-stage');
  const copies = [...ocean.querySelectorAll<HTMLElement>('[data-copy]')];
  if (!host || !stage) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let generation = 0;
  let release: () => void = () => {};

  function reset() {
    ocean.dataset.scene = 'static';
    ocean.dataset.renderState = 'paused';
    delete ocean.dataset.phase;
    delete ocean.dataset.ink;
    delete ocean.dataset.progress;
    stage!.style.removeProperty('--ocean-bg');
    stage!.style.removeProperty('--copy-tint');
    for (const copy of copies) {
      copy.style.removeProperty('opacity');
      copy.style.removeProperty('transform');
    }
  }

  async function initialize() {
    const current = ++generation;
    release();
    release = () => {};
    reset();
    if (motion.matches || !ocean.isConnected) return;
    ocean.dataset.scene = 'loading';
    try {
      const [{ gsap }, { ScrollTrigger }, { createOceanScene }] = await Promise.all([
        import('gsap'), import('gsap/ScrollTrigger'), import('./scene'),
      ]);
      if (current !== generation || !ocean.isConnected) return;
      gsap.registerPlugin(ScrollTrigger);
      const palette = readPalette();
      const bounds = ocean.getBoundingClientRect();
      let visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
      let disposed = false;
      let raf = 0;
      let last = 0;
      let elapsed = 0;
      let target = 0;
      let shown = 0;
      let snap = true;
      const fail = () => {
        if (current !== generation) return;
        release();
        release = () => {};
        reset();
        ocean.dataset.scene = 'fallback';
      };
      const view = createOceanScene(host!, palette, fail);
      const applied = new Map<HTMLElement, string>();
      let background = '';
      let tint = '';
      let progressLabel = '';

      // Overlay text, the stage color and test hooks; written only on change.
      function paint(frame: OceanFrame) {
        for (const copy of copies) {
          // Compare what is written, so easing always lands exactly on 0 / 1.
          const opacity = (frame.copy[copy.dataset.copy as CopyKey] ?? 0).toFixed(3);
          if (applied.get(copy) === opacity) continue;
          applied.set(copy, opacity);
          copy.style.opacity = opacity;
          copy.style.transform = `translate3d(0, ${((1 - Number(opacity)) * 14).toFixed(1)}px, 0)`;
        }
        const color = rgbCSS(frame.fogColor);
        if (color !== background) stage!.style.setProperty('--ocean-bg', background = color);
        const copyTint = frame.copyTint.toFixed(3);
        if (copyTint !== tint) stage!.style.setProperty('--copy-tint', tint = copyTint);
        if (ocean.dataset.phase !== frame.phase) ocean.dataset.phase = frame.phase;
        if (ocean.dataset.ink !== frame.ink) ocean.dataset.ink = frame.ink;
        const label = frame.progress.toFixed(2);
        if (label !== progressLabel) ocean.dataset.progress = progressLabel = label;
      }

      function tick(now: number) {
        raf = 0;
        if (disposed || !visible || document.hidden) return;
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        elapsed += dt;
        // Ease toward the scroll position; jumps after a pause snap instead.
        shown = snap ? target : shown + (target - shown) * (1 - Math.exp(-dt * 4.5));
        if (Math.abs(target - shown) < 1e-4) shown = target;
        snap = false;
        const frame = oceanFrame(shown, palette);
        try { view.draw(frame, elapsed); } catch { fail(); return; }
        paint(frame);
        raf = requestAnimationFrame(tick);
      }

      function schedule() {
        const active = visible && !document.hidden && !disposed;
        ocean.dataset.renderState = active ? 'active' : 'paused';
        if (!active) {
          cancelAnimationFrame(raf);
          raf = 0;
          last = 0;
          snap = true;
          return;
        }
        if (!raf) raf = requestAnimationFrame(tick);
      }

      const trigger = ScrollTrigger.create({
        trigger: ocean,
        start: 'top top',
        end: () => `+=${Math.max(1, ocean.offsetHeight - stage!.offsetHeight)}`,
        onUpdate: (self) => { target = self.progress; },
        onRefresh: (self) => { target = self.progress; },
      });
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        schedule();
      });
      observer.observe(ocean);
      document.addEventListener('visibilitychange', schedule);
      const resize = new ResizeObserver(() => {
        if (disposed) return;
        view.resize();
        trigger.refresh();
        snap = true;
      });
      resize.observe(stage!);
      release = () => {
        disposed = true;
        cancelAnimationFrame(raf);
        trigger.kill();
        observer.disconnect();
        resize.disconnect();
        document.removeEventListener('visibilitychange', schedule);
        view.dispose();
      };
      ocean.dataset.scene = 'ready';
      trigger.refresh();
      target = trigger.progress;
      schedule();
    } catch {
      if (current !== generation) return;
      release();
      release = () => {};
      host!.replaceChildren();
      reset();
      ocean.dataset.scene = 'fallback';
    }
  }

  motion.addEventListener('change', initialize);
  window.addEventListener('pagehide', () => { generation++; release(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) void initialize(); });
  void initialize();
}
