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
  await expect(page.locator('h1')).toHaveText('Arete Club Beyond the Surface.');
  await expect(page.locator('.hero-sub')).toHaveText('Independent AI Research & Development');
  for (const text of ['Explore the Unknown.', 'We explore the frontiers of intelligence.', 'Curiosity drives discovery.', 'Excellence shapes what comes next.']) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.locator('main > section, .deep-content > section, .deep-content > footer')).toHaveCount(6);
  await expect(page.locator('.research-row')).toHaveCount(4);
  await expect(page.locator('.project-card')).toHaveCount(3);
  await expect(page.locator('[data-project="Sentinel"] a, .project-status')).toHaveCount(0);
  await expect(page.locator('[data-project="SkillFetch"] a')).toHaveAttribute('href', 'https://github.com/Arete-Club/SkillFetch');
  await expect(page.locator('[data-project="Handoff"] a')).toHaveAttribute('href', 'https://github.com/Arete-Club/handoff-skill');
  await expect(page.locator('#exploration a')).toHaveAttribute('href', 'https://github.com/Arete-Club');
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Arete Club/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /독립 연구/);
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

for (const [width, height] of [[375, 667], [375, 900], [768, 900], [1440, 900]]) {
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
    for (const [progress, key] of [[0.58, 'descent'], [0.92, 'abyss']] as const) {
      await scrollOcean(page, progress);
      const rect = await page.locator(`${copy(key)} .wrap`).boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(height);
    }
    for (const selector of ['.statement-sub', '.about-copy p', '.research-heading p', '.research-row p', '.project-body p', '.exploration-body p']) {
      expect(await page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    }
    await page.locator('#projects').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('T06: keyboard access, semantic headings and anchor navigation', async ({ page }) => {
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
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
  await expect(page.getByText('Curiosity drives discovery.')).toBeVisible();
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
  await expect(page.getByText('Explore the Unknown.')).toBeVisible();
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
  await page.getByRole('link', { name: 'BACK TO SURFACE' }).click();
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

test('V01: desktop/mobile captures and browser rendering profile', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const profiles = [];
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await ready(page);
    for (const [label, progress] of [['surface', 0], ['crossing', 0.3], ['descent', 0.58], ['abyss', 1]] as const) {
      await scrollOcean(page, progress);
      await page.waitForTimeout(500);
      await page.screenshot({ path: testInfo.outputPath(`${width}-${label}.png`) });
    }
    for (const section of ['about', 'research', 'projects', 'exploration', 'contact']) {
      await page.locator(`#${section}`).scrollIntoViewIfNeeded();
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
