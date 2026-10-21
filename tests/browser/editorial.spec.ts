import { test, expect, type Page } from '@playwright/test';

async function trackReveals(page: Page) {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      if (this instanceof HTMLElement && this.hasAttribute('data-reveal')) {
        this.dataset.testReveals = String(Number(this.dataset.testReveals ?? 0) + 1);
      }
      return animate.apply(this, args);
    };
  });
}

for (const [width, height] of [[375, 667], [390, 844], [768, 900], [900, 900], [901, 900], [1440, 900]]) {
  test(`R02–R04: aligned, readable body at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const layout = await page.evaluate(() => {
      const grids = Array.from(document.querySelectorAll('.section-grid')).map((grid) => {
        const [left, right] = Array.from(grid.children).map((el) => el.getBoundingClientRect());
        return { left: left.left, right: right.left, leftBottom: left.bottom, rightTop: right.top, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length };
      });
      const clipping: string[] = [];
      for (const el of document.querySelectorAll('.deep-content :is(h2, h3, p, a, .record)')) {
        const range = document.createRange();
        range.selectNodeContents(el);
        if (Array.from(range.getClientRects()).some((r) => r.left < 0 || r.right > innerWidth + 1)) clipping.push(el.textContent!);
      }
      const sizes = Array.from(document.querySelectorAll('.deep-content :is(p, .small-label, .record, .section-label)')).map((el) => ({
        small: el.matches('.small-label, .record, .section-label, .project-category'),
        size: parseFloat(getComputedStyle(el).fontSize),
      }));
      return { grids, clipping, sizes, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.clipping).toEqual([]);
    for (const grid of layout.grids) {
      expect(grid.left).toBeCloseTo(layout.grids[0].left, 1);
      expect(grid.right).toBeCloseTo(layout.grids[0].right, 1);
      expect(grid.columns).toBe(width > 900 ? 12 : 1);
      if (width <= 900) expect(grid.rightTop).toBeGreaterThanOrEqual(grid.leftBottom);
    }
    for (const { small, size } of layout.sizes) expect(size).toBeGreaterThanOrEqual(small ? 13 : 16);
    await expect(page.locator('.project-card')).toHaveCount(3);
    await expect(page.locator('[data-project="Sentinel"] a')).toHaveCount(0);
    await expect(page.locator('[data-project="Sentinel"]')).not.toHaveCSS('cursor', 'pointer');
    for (const row of await page.locator('.project-card').all()) {
      const heading = (await row.locator('.project-heading').boundingBox())!;
      const body = (await row.locator('.project-body').boundingBox())!;
      if (width > 900) expect(heading.x + heading.width).toBeLessThan(body.x);
      else expect(heading.y + heading.height).toBeLessThan(body.y);
    }
  });
}

test('R03/R05: body and link states retain contrast, hover and keyboard feedback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#projects');
  const links = page.locator('.action-link');
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const rest = await link.evaluate((el) => getComputedStyle(el).backgroundColor);
    await link.hover();
    await expect(link).not.toHaveCSS('background-color', rest);
    const hover = await link.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.mouse.move(0, 0);
    await link.focus();
    // Use a real Tab transition back onto the link to exercise focus-visible.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS('background-color', hover);
    await expect(link).toHaveCSS('outline-style', 'solid');
    await expect(link).toHaveCSS('outline-width', '2px');
    await link.blur();
  }
  const minimum = await page.evaluate(() => {
    const sample = document.createElement('canvas').getContext('2d')!;
    const rgba = (color: string) => {
      sample.clearRect(0, 0, 1, 1);
      sample.fillStyle = color;
      sample.fillRect(0, 0, 1, 1);
      return [...sample.getImageData(0, 0, 1, 1).data];
    };
    const luminance = (channels: number[]) => channels.slice(0, 3).reduce((sum, c, i) => {
      const v = c / 255;
      return sum + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
    }, 0);
    // Deep Ocean is the lightest point of the body's gradient. Include the link tint.
    const background = rgba(getComputedStyle(document.documentElement).getPropertyValue('--deep').trim());
    const cyan = rgba(getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim());
    const brightLink = background.map((c, i) => c * .88 + cyan[i] * .12);
    return Math.min(...Array.from(document.querySelectorAll('.deep-content :is(h2, h3, p, a, span, .section-label)')).map((el) => {
      const ink = luminance(rgba(getComputedStyle(el).color));
      const bg = luminance(el.closest('.action-link') ? brightLink : background);
      return (ink + .05) / (bg + .05);
    }));
  });
  expect(minimum).toBeGreaterThanOrEqual(4.5);
});

test('R06: first-entry motion runs once, anchors and focus bypass it', async ({ page }) => {
  await trackReveals(page);
  await page.goto('/');
  const about = page.locator('#about [data-reveal]');
  await about.first().scrollIntoViewIfNeeded();
  await expect(about.first()).toHaveAttribute('data-test-reveals', '1');
  await expect(about.last()).toHaveCSS('opacity', '1');
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('nav')).toBeInViewport();
  await about.first().scrollIntoViewIfNeeded();
  await expect(about.first()).toHaveAttribute('data-test-reveals', '1');
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole('navigation').getByRole('link', { name: 'Projects' }).click();
  await expect(page).toHaveURL(/#projects$/);
  for (const block of await page.locator('#projects [data-reveal]').all()) {
    await expect(block).toHaveCSS('opacity', '1');
    expect(await block.evaluate((el) => el.getAnimations().length)).toBe(0);
    expect(await block.getAttribute('data-test-reveals')).toBeNull();
  }
  const cta = page.locator('#exploration a');
  await cta.scrollIntoViewIfNeeded();
  await expect(page.locator('#exploration [data-reveal="detail"]')).toHaveAttribute('data-test-reveals', '1');
  await cta.focus();
  expect(await cta.evaluate((el) => el.closest('[data-reveal]')!.getAnimations().length)).toBe(0);
  await expect(page.locator('#exploration [data-reveal="detail"]')).toHaveCSS('opacity', '1');
});

test('R06: changing motion preference cancels active and pending reveals', async ({ page }) => {
  await trackReveals(page);
  await page.goto('/');
  await page.locator('#about h2').scrollIntoViewIfNeeded();
  await expect(page.locator('#about [data-reveal]').first()).toHaveAttribute('data-test-reveals', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#about [data-reveal]').first()).toHaveCSS('opacity', '1');
  await page.locator('#projects h2').scrollIntoViewIfNeeded();
  expect(await page.locator('#projects h2').getAttribute('data-test-reveals')).toBeNull();
  expect(await page.locator('.deep-content').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

for (const missing of ['IntersectionObserver', 'animate', 'JavaScript', 'reduced motion']) {
  test(`R06: content stays visible without ${missing}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: missing !== 'JavaScript', reducedMotion: missing === 'reduced motion' ? 'reduce' : 'no-preference', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript((api) => {
      if (api === 'IntersectionObserver') Object.defineProperty(window, 'IntersectionObserver', { value: undefined });
      if (api === 'animate') Object.defineProperty(Element.prototype, 'animate', { value: undefined });
    }, missing);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#projects');
    for (const block of await page.locator('.deep-content [data-reveal]').all()) await expect(block).toHaveCSS('opacity', '1');
    await expect(page.locator('#projects h2')).toBeInViewport();
    await expect(page.locator('[data-project="Handoff"] a')).toBeVisible();
    expect(await page.locator('.deep-content').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
