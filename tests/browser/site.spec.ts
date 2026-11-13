import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const copy = (key: string) => `.ocean [data-copy="${key}"]`;

async function ready(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'ready');
}

async function scrollOcean(page: Page, progress: number) {
  await page.evaluate((value) => {
    const ocean = document.querySelector<HTMLElement>('.ocean')!;
    const stage = document.querySelector<HTMLElement>('.ocean-stage')!;
    window.scrollTo(0, (ocean.offsetHeight - stage.offsetHeight) * value);
  }, progress);
  // The camera eases towards the scroll position; wait until it arrives.
  await expect(page.locator('.ocean')).toHaveAttribute('data-progress', progress.toFixed(2));
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test('T01/T02/T09: static content, honest links and metadata without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Beyond the Surface.');
  await expect(page.locator('.scene-eyebrow')).toHaveText('Independent AI Research & Development');
  for (const text of [
    'Beneath the Familiar.', 'Beyond the Known.',
    'AI grows through new discoveries and inventions.', 'We begin with the technology around us.',
    'Beneath familiar tools lie layers of ideas and systems.', 'We look deeper to understand the AI we already know.',
    'What lies beyond what we know?', 'We explore what has yet to be discovered or created.',
  ]) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.locator('.about-copy')).toContainText('We approach AI with the same curiosity:');
  // Korean ships in the HTML for the language switch (K07), but in English it stays out of
  // visible text, accessible names and metadata; without JavaScript there is no switch.
  const korean = await page.evaluate(() => {
    const hangul = /\p{Script=Hangul}/u;
    const issues: string[] = [];
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (hangul.test(node.textContent!) && !node.parentElement!.closest('[data-lang="ko"]')) issues.push(`text: ${node.textContent!.trim()}`);
    }
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (hangul.test(attribute.value) && !['data-label-ko', 'data-title-ko'].includes(attribute.name)) issues.push(`${attribute.name}: ${attribute.value}`);
      }
    }
    if (hangul.test(document.body.innerText)) issues.push('visible text');
    return issues;
  });
  expect(korean).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.lang-toggle')).toBeHidden();
  await expect(page.locator('main > section, .deep-content > section, .deep-content > footer')).toHaveCount(6);
  await expect(page.locator('.research-row')).toHaveCount(4);
  await expect(page.locator('.project-card')).toHaveCount(3);
  await expect(page.locator('[data-project="Sentinel"] a, .project-status')).toHaveCount(0);
  await expect(page.locator('[data-project="SkillFetch"] a')).toHaveAttribute('href', 'https://github.com/Arete-Club/SkillFetch');
  await expect(page.locator('[data-project="Handoff"] a')).toHaveAttribute('href', 'https://github.com/Arete-Club/handoff-skill');
  await expect(page.locator('#exploration a')).toHaveAttribute('href', 'https://github.com/Arete-Club');
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Arete Club/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /independent AI research/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /independent AI research/);
  await expect(page.locator('meta[property="og:url"], meta[property="og:image"], link[rel="canonical"]')).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(page.locator('#projects h2')).toBeInViewport();
  await context.close();
});

test('T04: real ocean canvas, continuous descent and reversible scroll', async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  const ocean = page.locator('.ocean');
  await expect(page.locator('.ocean canvas')).toHaveCount(1);
  await scrollOcean(page, 0);
  await expect(ocean).toHaveAttribute('data-phase', 'surface');
  await expect(ocean).toHaveAttribute('data-ink', 'dark');
  await expect(page.locator(copy('hero'))).toHaveCSS('opacity', '1');
  await scrollOcean(page, 0.3);
  await expect(ocean).toHaveAttribute('data-phase', 'crossing');
  await expect(page.locator(copy('hero'))).toHaveCSS('opacity', '0');
  await scrollOcean(page, 0.58);
  await expect(ocean).toHaveAttribute('data-phase', 'descent');
  await expect(ocean).toHaveAttribute('data-ink', 'light');
  await expect(page.locator(copy('descent'))).toHaveCSS('opacity', '1');
  await scrollOcean(page, 1);
  await expect(ocean).toHaveAttribute('data-phase', 'abyss');
  await expect(page.locator(copy('descent'))).toHaveCSS('opacity', '0');
  await expect(page.locator(copy('abyss'))).toHaveCSS('opacity', '1');
  await expect(page.locator('.ocean-stage')).toHaveCSS('background-color', 'rgb(6, 21, 33)');
  await expect(page.locator('.deep-content')).toHaveCSS('background-color', 'rgb(6, 21, 33)');
  await scrollOcean(page, 0);
  await expect(page.locator(copy('hero'))).toHaveCSS('opacity', '1');
  await expect(page.locator(copy('abyss'))).toHaveCSS('opacity', '0');
  await expect(ocean).toHaveAttribute('data-ink', 'dark');
  expect(errors).toEqual([]);
});

for (const [width, height] of [[375, 667], [375, 900], [390, 844], [768, 900], [1440, 900]]) {
  test(`T05: readable layout at ${width}x${height}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    const hero = await page.evaluate(() => {
      const rect = document.querySelector('.hero-copy .wrap')!.getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, right: rect.right, bottom: rect.bottom };
    });
    expect(hero.overflow).toBe(false);
    expect(hero.right).toBeLessThanOrEqual(width);
    // Navy hero copy must stay on the sky, above the horizon (~58% height).
    expect(hero.bottom).toBeLessThan(height * 0.55);
    const eyebrow = await page.locator('.scene-eyebrow').boundingBox();
    const headline = await page.locator('h1').boundingBox();
    expect(eyebrow!.y + eyebrow!.height).toBeLessThan(headline!.y);
    for (const [progress, key] of [[0, 'hero'], [0.58, 'descent'], [0.92, 'abyss']] as const) {
      await scrollOcean(page, progress);
      await expect(page.locator(copy(key))).toHaveCSS('opacity', '1');
      const rect = await page.locator(`${copy(key)} .wrap`).boundingBox();
      expect(rect!.x).toBeCloseTo(headline!.x, 0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      const header = await page.locator('.site-header').boundingBox();
      expect(rect!.y).toBeGreaterThan(header!.y + header!.height);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(height);
      const description = page.locator(`${copy(key)} .story-description`);
      const descriptionRect = await description.boundingBox();
      const titleRect = await page.locator(`${copy(key)} :is(.hero-title, .statement-lead)`).boundingBox();
      expect(descriptionRect!.y).toBeGreaterThan(titleRect!.y + titleRect!.height);
      const fontSize = await description.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fontSize).toBeGreaterThanOrEqual(width <= 600 ? 16 : 18);
      expect(fontSize).toBeLessThanOrEqual(width <= 600 ? 18 : 20);
      await expect(description).toHaveCSS('text-align', 'left');
      // Check actual text fragments, not only the container, for clipping.
      const textFits = await description.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return Array.from(range.getClientRects()).every((box) =>
          box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight);
      });
      expect(textFits).toBe(true);
    }
    for (const selector of ['.statement-sub', '.about-copy p', '.research-heading p', '.research-row p', '.project-body p:not(.project-category)', '.exploration-body p']) {
      expect(await page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    await page.locator('#projects').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('T06: keyboard access, semantic headings and anchor navigation', async ({ page }) => {
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('.skip-link')).toHaveText('Skip to content', { useInnerText: true });
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.ocean-canvas')).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#about$/);
  await expect(page.locator('#about h2')).toBeInViewport();
});

test('T07: reduced motion stays static and can be toggled without duplicate canvases', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'static');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByText('Beyond the Known.', { exact: true })).toBeVisible();
  await expect(page.locator('.story-description')).toHaveCount(3);
  await page.getByRole('navigation').getByRole('link', { name: 'Projects' }).click();
  await expect(page.locator('#projects h2')).toBeInViewport();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'ready');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator(copy('abyss'))).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('canvas')).toHaveCount(1);
});

for (const [width, height] of [[375, 812], [1440, 900]]) {
  test(`T07: reduced motion at ${width}px leaves no blank gap after the static scenes`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'static');
    // The stacked panels are the whole section; any extra height is empty navy before About.
    const [ocean, stage] = await page.evaluate(() =>
      ['.ocean', '.ocean-stage'].map((selector) => document.querySelector<HTMLElement>(selector)!.offsetHeight));
    expect(ocean).toBe(stage);
  });
}

test('T07: no WebGL preserves all content and usable links', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).includes('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('.ocean canvas')).toHaveCount(0);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByText('Beneath the Familiar.', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Projects' }).click();
  await expect(page.locator('#projects h2')).toBeInViewport();
});

test('T07: a shader the driver rejects falls back instead of rendering broken', async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.getProgramParameter;
    WebGL2RenderingContext.prototype.getProgramParameter = function (this: WebGL2RenderingContext, program, name) {
      return name === this.LINK_STATUS ? false : original.call(this, program, name);
    };
  });
  await page.goto('/');
  await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('h1')).toBeVisible();
});

test('T07: failed 3D module falls back without blocking content', async ({ page }) => {
  await page.route('**/scene.*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.project-card')).toHaveCount(3);
});

test('T07: context loss releases the canvas and restores the static layout', async ({ page }) => {
  await ready(page);
  await page.locator('canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.locator('.ocean')).toHaveAttribute('data-scene', 'fallback');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator(copy('descent'))).toHaveCSS('opacity', '1');
});

test('T08: viewport exit, resize, direct anchor and re-entry', async ({ page }) => {
  await ready(page, '/#projects');
  await expect(page.locator('#projects h2')).toBeInViewport();
  await expect(page.locator('.ocean')).toHaveAttribute('data-render-state', 'paused');
  await page.setViewportSize({ width: 768, height: 850 });
  await page.getByRole('link', { name: 'Back to surface' }).click();
  await expect(page.locator('h1')).toBeInViewport();
  await expect(page.locator('.ocean')).toHaveAttribute('data-render-state', 'active');
  await expect(page.locator(copy('hero'))).toHaveCSS('opacity', '1');
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('T08: hidden document suspends drawing and resumes on visibility', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.ocean')).toHaveAttribute('data-render-state', 'paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.ocean')).toHaveAttribute('data-render-state', 'active');
});

test('T10: the crossing has no bright horizontal rim across the water', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    // Crossing frames skip the sun on the right; once submerged (L02) the
    // whole width is checked, so no glint may remain on the far waterline.
    for (const [progress, fullWidth] of [
      [0.22, false], [0.26, false], [0.3, false], [0.34, false], [0.38, true], [0.4, true], [0.42, true], [0.45, true],
    ] as const) {
      await scrollOcean(page, progress);
      // data-progress rounds to two decimals, so it can report the target
      // while the camera is still up to .005 away. Allow the existing 4.5/s
      // easing to reach its 1e-4 snap tolerance before judging a pixel band.
      await page.waitForTimeout(1000);
      // Read the rendered canvas in the draw frame (before the browser clears
      // its non-preserved backbuffer).
      const band = await page.locator('canvas').evaluate(async (canvas: HTMLCanvasElement, whole: boolean) => {
        return new Promise<{ brightRim: number; peak: number }>((resolve) => requestAnimationFrame(() => {
          const gl = canvas.getContext('webgl2')!;
          const height = gl.drawingBufferHeight;
          const width = Math.floor(gl.drawingBufferWidth * (whole ? 1 : 0.5));
          const pixels = new Uint8Array(width * height * 4);
          gl.readPixels(whole ? 0 : Math.floor(gl.drawingBufferWidth * 0.1), 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const luma = (x: number, y: number) => {
            const i = (y * width + x) * 4;
            return (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) / 255;
          };
          const offset = Math.ceil(height * 0.035);
          let brightRim = 0;
          let peak = 0;
          for (let y = offset; y < height - offset; y += 2) {
            let ridge = 0;
            for (let column = 0; column < 9; column++) {
              const x = Math.floor((column + 0.5) / 9 * width);
              const value = luma(x, y);
              peak = Math.max(peak, value);
              if (value > 0.45 && value - Math.max(luma(x, y - offset), luma(x, y + offset)) > 0.1) ridge++;
            }
            brightRim = Math.max(brightRim, ridge / 9);
          }
          resolve({ brightRim, peak });
        }));
      }, fullWidth);
      expect(band.peak, 'must sample a rendered frame, not a cleared buffer').toBeGreaterThan(0.1);
      expect(band.brightRim, `white rim at ${width}px / progress ${progress}`).toBeLessThan(0.5);
    }
  }
  expect(errors).toEqual([]);
});

test('T11: structure carries information, not template chrome', async ({ page }) => {
  await ready(page);
  const chrome = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('body *'))
    .filter((el) => Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()))
    .flatMap((el) => {
      const style = getComputedStyle(el);
      const text = el.textContent!.trim();
      const issues: string[] = [];
      if (style.textTransform === 'uppercase') issues.push(`uppercase: ${text}`);
      // Monospace is reserved for real data, such as a repository path.
      const record = el.closest('.record') && /^[\w.-]+\/[\w.-]+$/.test(text);
      if (/mono/i.test(style.fontFamily) && !record) issues.push(`monospace: ${text}`);
      // Unordered lists get no sequence numbers; a bare cross implies an expansion that does not exist.
      if (/^(\d{2}|\+)$/.test(text) || /\b\d{2} \//.test(text)) issues.push(`marker: ${text}`);
      return issues;
    }));
  expect(chrome).toEqual([]);
  await expect(page.locator('h2 .accent')).toHaveCount(0);
  // ↗ means leaving the site; an in-page anchor must not carry it.
  expect(await page.getByRole('navigation').locator('a[href="#projects"]').textContent()).toBe('Projects');
  for (const selector of ['.scene-eyebrow', '.scroll-cue span', '.section-label', '.values span', '.project-category', '.footer-bottom > span', '.back-top']) {
    expect(await page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), selector).toBeGreaterThanOrEqual(13);
  }
});

for (const [width, height] of [[1440, 900], [375, 812]]) {
  test(`T12: scene copy keeps 4.5:1 against the rendered pixels behind it at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height });
    await ready(page);
    for (const [key, progress] of [
      ['hero', 0], ['descent', 0.44], ['descent', 0.5], ['descent', 0.56], ['descent', 0.62], ['abyss', 0.8], ['abyss', 0.9], ['abyss', 1],
    ] as const) {
      await scrollOcean(page, progress);
      await expect(page.locator(copy(key))).toHaveCSS('opacity', '1');
      const result = await page.evaluate(async (selector) => {
        const wrap = document.querySelector<HTMLElement>(`${selector} .wrap`)!;
        const ink = getComputedStyle(wrap.querySelector(':is(.hero-title, .statement-lead)')!).color;
        // Computed colors arrive as rgb(…) or, from color-mix, color(srgb …).
        const channels = ink.startsWith('color(')
          ? ink.slice(11, -1).split(' ').slice(0, 3).map((v) => Number(v) * 255)
          : ink.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const linear = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        const luminance = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
        const text = luminance(channels[0], channels[1], channels[2]);
        const canvas = document.querySelector<HTMLCanvasElement>('.ocean canvas')!;
        const box = wrap.getBoundingClientRect();
        const frame = canvas.getBoundingClientRect();
        return new Promise<{ ratio: number; ink: string }>((resolve) => requestAnimationFrame(() => {
          const gl = canvas.getContext('webgl2')!;
          const scale = gl.drawingBufferWidth / frame.width;
          const x = Math.max(0, Math.floor((box.left - frame.left) * scale));
          const w = Math.min(gl.drawingBufferWidth - x, Math.ceil(box.width * scale));
          const top = Math.max(0, Math.floor((box.top - frame.top) * scale));
          const h = Math.min(gl.drawingBufferHeight - top, Math.ceil(box.height * scale));
          const pixels = new Uint8Array(w * h * 4);
          gl.readPixels(x, gl.drawingBufferHeight - top - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const values: number[] = [];
          for (let i = 0; i < pixels.length; i += 16) values.push(luminance(pixels[i], pixels[i + 1], pixels[i + 2]));
          values.sort((a, b) => a - b);
          // Light ink is judged against the brightest 2% behind it, dark ink
          // against the darkest 2%: a few drifting motes may not decide it.
          const background = text > values[values.length >> 1]
            ? values[Math.floor(values.length * 0.98)]
            : values[Math.floor(values.length * 0.02)];
          const [hi, lo] = text > background ? [text, background] : [background, text];
          resolve({ ratio: (hi + 0.05) / (lo + 0.05), ink });
        }));
      }, copy(key));
      expect(result.ratio, `${key} at ${progress} (${result.ink})`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

const OFF_WHITE = 'rgb(241, 244, 242)';
const NAVY = 'rgb(6, 21, 33)';

async function expectPinnedHeader(page: Page) {
  expect((await page.locator('.site-header').boundingBox())!.y).toBe(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeInViewport();
}

async function belowHeader(page: Page, selector: string) {
  const [header, box] = await Promise.all([page.locator('.site-header').boundingBox(), page.locator(selector).boundingBox()]);
  expect(box!.y, selector).toBeGreaterThanOrEqual(header!.y + header!.height);
}

test('T13: the header stays at the top through the ocean sequence and the body', async ({ page }) => {
  await ready(page);
  const header = page.locator('.site-header');
  await expect(header).toHaveAttribute('data-state', 'surface');
  await expect(header).toHaveCSS('color', NAVY);
  await expect(header).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(header).toHaveCSS('backdrop-filter', 'none');
  await scrollOcean(page, 0.92);
  await expect(header).toHaveAttribute('data-state', 'scene');
  await expect(header).toHaveCSS('color', OFF_WHITE);
  await expect(header).toHaveCSS('backdrop-filter', 'none');
  await expectPinnedHeader(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  await expect(header).toHaveAttribute('data-state', 'solid');
  await expect(header).toHaveCSS('color', OFF_WHITE);
  await expect(header).toHaveCSS('background-color', /0\.72\)$/);
  await expect(header).toHaveCSS('backdrop-filter', 'blur(16px)');
  await expectPinnedHeader(page);
  await belowHeader(page, '#projects .section-label');
  await page.getByRole('link', { name: 'Back to surface' }).click();
  await expect(header).toHaveAttribute('data-state', 'surface');
});

for (const mode of ['reduced motion', 'no WebGL'] as const) {
  test(`T13: ${mode} — clear over the sky-blue hero, a navy bar from the navy panels`, async ({ page }) => {
    if (mode === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        return String(args[0]).includes('webgl') ? null : original.apply(this, args);
      } as typeof original;
    });
    await page.goto('/');
    await expect(page.locator('.ocean')).toHaveAttribute('data-scene', mode === 'reduced motion' ? 'static' : 'fallback');
    const header = page.locator('.site-header');
    await expect(header).toHaveAttribute('data-state', 'surface');
    await expect(header).toHaveCSS('color', NAVY);
    // The panels keep their place under the fixed header.
    expect((await page.locator('.hero-copy').boundingBox())!.y).toBeCloseTo(91, 0);
    await page.locator('.descent-copy').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 40));
    await expect(header).toHaveAttribute('data-state', 'solid');
    await expect(header).toHaveCSS('color', OFF_WHITE);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(header).toHaveAttribute('data-state', 'solid');
    await expectPinnedHeader(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Research' }).click();
    await belowHeader(page, '#research .section-label');
  });
}

test('T13: without JavaScript the header is a navy bar that stays at the top', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const header = page.locator('.site-header');
  await expect(header).not.toHaveAttribute('data-state');
  await expect(header).toHaveCSS('color', OFF_WHITE);
  await expect(header).toHaveCSS('backdrop-filter', 'blur(16px)');
  await page.getByRole('navigation').getByRole('link', { name: 'Research' }).click();
  await expectPinnedHeader(page);
  await belowHeader(page, '#research .section-label');
  await context.close();
});

test('T13: keyboard focus is not left under the header', async ({ page }) => {
  await ready(page);
  const target = page.locator('[data-project="Handoff"] a');
  await page.locator('[data-project="SkillFetch"] a').evaluate((el: HTMLElement) => el.focus({ preventScroll: true }));
  // Park the next link right behind the bar, then move focus to it from the keyboard.
  await target.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 30));
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
  await belowHeader(page, '[data-project="Handoff"] a');
});

for (const [width, height] of [[1440, 900], [375, 812]]) {
  test(`T13: header ink keeps 4.5:1 while body headings pass behind it at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    const header = page.locator('.site-header');
    for (const selector of ['#about h2', '#research h2', '.research-row h3', '#projects h2', '.project-heading h3', '#exploration h2']) {
      const heading = page.locator(selector).first();
      // Put a bright heading right behind the bar, then let reveals and the bar's fade settle.
      await heading.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 16));
      await expect(header).toHaveAttribute('data-state', 'solid');
      await heading.evaluate(async (el) => {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const settling = [...el.closest('section')!.getAnimations({ subtree: true }), ...document.querySelector('.site-header')!.getAnimations()];
        await Promise.all(settling.map((animation) => animation.finished.catch(() => {})));
      });
      const box = (await header.boundingBox())!;
      const shot = await page.screenshot({ clip: { x: 0, y: 0, width: box.width, height: box.height }, scale: 'css' });
      const ratio = await page.evaluate(async (png) => {
        const bar = document.querySelector<HTMLElement>('.site-header')!;
        const glyphs = [...bar.querySelectorAll('.wordmark, nav a')].map((el) => el.getBoundingClientRect());
        const top = Math.min(...glyphs.map((rect) => rect.top));
        const bottom = Math.max(...glyphs.map((rect) => rect.bottom));
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0);
        const { data, width: columns } = context.getImageData(0, 0, image.width, image.height);
        const linear = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        const luminance = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
        // The bar's own pixels above and below the text line (no glyphs, no rule).
        const values: number[] = [];
        for (const [from, to] of [[2, top - 3], [bottom + 3, bar.offsetHeight - 3]]) {
          for (let y = Math.ceil(from); y < to; y++) {
            for (let x = 0; x < columns; x += 2) {
              const i = (y * columns + x) * 4;
              values.push(luminance(data[i], data[i + 1], data[i + 2]));
            }
          }
        }
        values.sort((a, b) => a - b);
        const ink = getComputedStyle(bar).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        return (luminance(ink[0], ink[1], ink[2]) + 0.05) / (values[Math.floor(values.length * 0.98)] + 0.05);
      }, shot.toString('base64'));
      expect(ratio, selector).toBeGreaterThanOrEqual(4.5);
    }
  });
}

for (const [width, height] of [[360, 780], [375, 812], [390, 844], [1440, 900]]) {
  test(`T14: the header with the language toggle stays on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    const layout = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const inner = box('.site-header-inner');
      const wordmark = box('.site-header .wordmark');
      const end = box('.header-end');
      const items = [...document.querySelectorAll('.site-header-inner a, .lang-toggle button')].map((el) => el.getBoundingClientRect());
      const middles = items.map((rect) => rect.top + rect.height / 2);
      const [en, ko] = [...document.querySelectorAll('.lang-toggle button')].map((el) => el.getBoundingClientRect());
      return {
        spread: Math.max(...middles) - Math.min(...middles),
        gap: end.left - wordmark.right,
        overRight: end.right - inner.right,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        centers: (ko.left + ko.width / 2) - (en.left + en.width / 2),
        heights: [en.height, ko.height],
      };
    });
    expect(layout.spread).toBeLessThanOrEqual(2);
    expect(layout.gap).toBeGreaterThanOrEqual(6);
    expect(layout.overRight).toBeLessThanOrEqual(0);
    expect(layout.pageOverflow).toBe(false);
    // WCAG 2.5.8: 24px targets, or centers at least 24px apart.
    expect(layout.centers).toBeGreaterThanOrEqual(24);
    for (const value of layout.heights) expect(value).toBeGreaterThanOrEqual(24);
  });
}

test('T14: the language toggle is reachable, labelled and keeps the address', async ({ page }) => {
  await ready(page);
  const group = page.getByRole('group', { name: 'Language' });
  const english = group.getByRole('button', { name: 'English' });
  const korean = group.getByRole('button', { name: 'Korean' });
  await expect(english).toHaveText('EN');
  await expect(korean).toHaveText('KO');
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await expect(korean).toHaveAttribute('aria-pressed', 'false');
  await expect(english).toHaveCSS('text-decoration-line', 'underline');
  await expect(korean).toHaveCSS('text-decoration-line', 'none');
  await page.locator('.site-header nav a').last().focus();
  await page.keyboard.press('Tab');
  await expect(english).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(korean).toBeFocused();
  const url = page.url();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  // The group is now named in Korean (K09), so find the button by its switch.
  const switched = page.locator('[data-switch="ko"]');
  await expect(switched).toHaveAttribute('aria-pressed', 'true');
  await expect(switched).toBeFocused();
  await expect(page.locator('h1')).toHaveText('Beyond the Surface.');
  expect(page.url()).toBe(url);
});

test('T14: the toggle uses the header ink in every header state', async ({ page }) => {
  await ready(page);
  const header = page.locator('.site-header');
  const sameInk = async () => {
    const [ink, ...toggle] = await page.evaluate(() => [
      getComputedStyle(document.querySelector('.site-header')!).color,
      ...[...document.querySelectorAll<HTMLElement>('.lang-toggle button, .lang-toggle span')].map((el) => `${getComputedStyle(el).color} ${getComputedStyle(el).opacity}`),
    ]);
    for (const value of toggle) expect(value).toBe(`${ink} 1`);
  };
  await expect(header).toHaveAttribute('data-state', 'surface');
  await sameInk();
  await scrollOcean(page, 0.92);
  await expect(header).toHaveAttribute('data-state', 'scene');
  await expect(header).toHaveCSS('color', OFF_WHITE);
  await sameInk();
  await page.getByRole('navigation').getByRole('link', { name: 'Projects' }).click();
  await expect(header).toHaveAttribute('data-state', 'solid');
  await expect(header).toHaveCSS('color', OFF_WHITE);
  await sameInk();
});

const KO_TITLE = 'Arete Club — 독립 AI 연구·개발';
// Brand titles and index stay in English in both languages (K06).
const keptEnglish = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(
  'h1, .scene-eyebrow, .statement-lead, h2, h3, .section-label, nav a, .project-category, .values, .footer-top p, .small-label:not(.research-caption), .record',
)].map((el) => el.innerText));

async function shownTranslations(page: Page) {
  return page.evaluate(() => {
    const hangul = /\p{Script=Hangul}/u;
    const shown = [...document.querySelectorAll<HTMLElement>('[data-lang]')].filter((el) => el.checkVisibility());
    return {
      en: shown.filter((el) => el.dataset.lang === 'en' && !hangul.test(el.textContent!)).length,
      ko: shown.filter((el) => el.dataset.lang === 'ko' && el.lang === 'ko' && hangul.test(el.textContent!)).length,
      total: shown.length,
      pairs: [document.querySelectorAll('[data-lang="en"]').length, document.querySelectorAll('[data-lang="ko"]').length],
    };
  });
}

test('T15: KO shows the details in Korean, EN brings English back, titles stay English', async ({ page }) => {
  await ready(page);
  const html = page.locator('html');
  const [english, korean] = [page.locator('[data-switch="en"]'), page.locator('[data-switch="ko"]')];
  const titles = await keptEnglish(page);
  const start = await shownTranslations(page);
  expect(start.pairs[0]).toBe(start.pairs[1]);
  expect(start.en).toBe(start.total);

  await korean.click();
  await expect(html).toHaveAttribute('lang', 'ko');
  await expect(korean).toHaveAttribute('aria-pressed', 'true');
  await expect(english).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveTitle(KO_TITLE);
  const shown = await shownTranslations(page);
  expect(shown.total).toBe(start.total);
  expect(shown.ko).toBe(shown.total);
  expect(await keptEnglish(page)).toEqual(titles);
  await expect(page.locator(`${copy('hero')} .story-description`)).toHaveText(/AI는 새로운 발견과 발명으로 자라납니다\./, { useInnerText: true });
  await expect(page.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await expect(page.getByRole('group', { name: '언어' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Arete Club — 맨 위로' })).toBeVisible();
  await expect(page.locator('[data-project="SkillFetch"] a')).toHaveAttribute('aria-label', 'GitHub 저장소 Arete-Club/SkillFetch');
  await expect(page.locator('#contact')).toHaveAttribute('aria-label', '연락처');
  await expect(page.getByRole('link', { name: '수면으로 돌아가기' })).toHaveCount(1);
  // The toggle keeps English names that match what it shows (K09).
  await expect(page.getByRole('button', { name: 'Korean' })).toHaveText('KO');

  await english.click();
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(english).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveTitle('Arete Club — Independent AI Research & Development');
  expect((await shownTranslations(page)).en).toBe(start.total);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('[data-project="SkillFetch"] a')).toHaveAttribute('aria-label', 'GitHub repository Arete-Club/SkillFetch');
  expect(await keptEnglish(page)).toEqual(titles);
});

test('T15: switching keeps the ocean where it was and the reader in place', async ({ page }) => {
  await ready(page);
  await scrollOcean(page, 0.58);
  await page.locator('[data-switch="ko"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.locator('.ocean')).toHaveAttribute('data-progress', '0.58');
  await expect(page.locator(copy('descent'))).toHaveCSS('opacity', '1');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('[data-switch="en"]').click();

  // Chromium keeps the position by itself (native scroll anchoring); turn that off to stand in
  // for browsers without it, so the switch's own correction is what is tested.
  await page.addStyleTag({ content: 'html { overflow-anchor: none !important; }' });
  // Body text above the Projects heading changes height between languages…
  const offset = () => page.evaluate(() => document.querySelector<HTMLElement>('#projects')!.offsetTop);
  // The section label has no entry animation, so its box moves only with the page.
  const target = page.locator('#projects .section-label');
  await target.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 160));
  const before = (await target.boundingBox())!.y;
  const englishTop = await offset();
  for (const language of ['ko', 'en'] as const) {
    await page.locator(`[data-switch="${language}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    // …yet what the reader was looking at stays where it was.
    expect(Math.abs((await target.boundingBox())!.y - before), language).toBeLessThanOrEqual(2);
    if (language === 'ko') expect(await offset()).not.toBe(englishTop);
  }
});

test('T15: the page always starts in English and stores nothing', async ({ page }) => {
  await ready(page);
  await page.locator('[data-switch="ko"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-switch="en"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
});

for (const [width, height] of [[375, 667], [390, 844], [1440, 900]]) {
  test(`T15: Korean copy fits the scenes and the body at ${width}x${height}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await ready(page);
    await page.locator('[data-switch="ko"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    for (const [progress, key] of [[0, 'hero'], [0.58, 'descent'], [0.92, 'abyss']] as const) {
      await scrollOcean(page, progress);
      await expect(page.locator(copy(key))).toHaveCSS('opacity', '1');
      const fit = await page.locator(`${copy(key)} .story-description`).evaluate((element) => {
        const header = document.querySelector('.site-header')!.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const boxes = Array.from(range.getClientRects());
        return boxes.length > 0 && boxes.every((box) => box.left >= 0 && box.right <= innerWidth && box.top >= header.bottom && box.bottom <= innerHeight);
      });
      expect(fit, `${key} at ${progress}`).toBe(true);
    }
    await scrollOcean(page, 0);
    // Navy hero copy stays on the sky, above the horizon (as T05).
    expect(await page.locator('.hero-copy .wrap').evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThan(height * 0.55);
    for (const selector of ['.about-copy [data-lang="ko"] p', '.research-heading p', '.research-row p', '.project-body p:not(.project-category)', '.exploration-body p']) {
      expect(await page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), selector).toBeGreaterThanOrEqual(16);
    }
    await page.locator('#contact').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('T16: the tab and home-screen icons are linked and served as PNGs at their sizes', async ({ page, request }) => {
  await page.goto('/');
  for (const [selector, href, size] of [
    ['head link[rel="icon"]', '/favicon.png', 64],
    ['head link[rel="apple-touch-icon"]', '/apple-touch-icon.png', 180],
  ] as const) {
    await expect(page.locator(selector)).toHaveAttribute('href', href);
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    const bytes = await response.body();
    // PNG signature, then the IHDR width and height (big-endian) at bytes 16–23.
    expect(bytes.subarray(0, 8).toString('hex'), href).toBe('89504e470d0a1a0a');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], href).toEqual([size, size]);
  }
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('type', 'image/png');
});

test('V01: desktop/mobile captures and browser rendering profile', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const profiles = [];
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    for (const [label, progress] of [
      ['surface', 0], ['approach', 0.17], ['crossing-enter', 0.22], ['crossing', 0.3],
      ['crossing-exit', 0.38], ['submerged', 0.44], ['descent', 0.52], ['deep', 0.66], ['abyss', 1],
    ] as const) {
      await scrollOcean(page, progress);
      await page.waitForTimeout(500);
      await page.screenshot({ path: testInfo.outputPath(`${width}-${label}.png`) });
    }
    for (const section of ['about', 'research', 'projects', 'exploration', 'contact']) {
      await page.locator(`#${section}`).scrollIntoViewIfNeeded();
      await page.locator(`#${section}`).evaluate(async (el) => {
        // Let IntersectionObserver start the reveal, then capture its settled state.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
      });
      await page.screenshot({ path: testInfo.outputPath(`${width}-${section}.png`) });
    }
    await scrollOcean(page, 0);
    const profile = await page.evaluate(async () => {
      const ocean = document.querySelector<HTMLElement>('.ocean')!;
      const stage = document.querySelector<HTMLElement>('.ocean-stage')!;
      const samples: number[] = [];
      let previous = performance.now();
      for (let i = 0; i < 90; i++) {
        window.scrollTo(0, (ocean.offsetHeight - stage.offsetHeight) * i / 89);
        await new Promise(requestAnimationFrame);
        const current = performance.now();
        samples.push(current - previous);
        previous = current;
      }
      return {
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        frameIntervalsMs: samples,
        resources: performance.getEntriesByType('resource').map((entry) => ({ name: entry.name, duration: entry.duration })),
        scene: ocean.dataset.scene,
      };
    });
    expect(profile.scene).toBe('ready');
    profiles.push({ environment: 'Playwright Chromium desktop / mobile viewport emulation; not a physical mobile device', ...profile });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('1440-static-fallback.png'), fullPage: true });
  await writeFile(testInfo.outputPath('rendering-profile.json'), JSON.stringify(profiles, null, 2));
});
