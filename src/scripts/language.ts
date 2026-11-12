export type Language = 'en' | 'ko';

/**
 * Same-page language switch (SPEC K07–K09). Both languages ship in the HTML and CSS shows the
 * one matching `<html lang>`; this swaps the page language, the toggle state, aria-labels
 * (`data-label-ko`) and the tab title (`data-title-ko`). The page always starts in English and
 * nothing is stored (K08).
 */
export function applyLanguage(language: Language, doc: Document = document) {
  doc.documentElement.lang = language;
  for (const element of doc.querySelectorAll<HTMLElement>('[data-label-ko]')) {
    element.dataset.labelEn ??= element.getAttribute('aria-label') ?? '';
    element.setAttribute('aria-label', language === 'ko' ? element.dataset.labelKo! : element.dataset.labelEn);
  }
  const title = doc.querySelector<HTMLTitleElement>('title[data-title-ko]');
  if (title) {
    title.dataset.titleEn ??= title.text;
    title.text = language === 'ko' ? title.dataset.titleKo! : title.dataset.titleEn;
  }
  for (const button of doc.querySelectorAll<HTMLButtonElement>('.lang-toggle [data-switch]')) {
    button.setAttribute('aria-pressed', String(button.dataset.switch === language));
  }
}

/** The element whose position the reader is looking at: just below the fixed header. */
function readingAnchor(): Element | null {
  const header = document.querySelector<HTMLElement>('.site-header');
  return document.elementFromPoint(innerWidth / 2, (header?.offsetHeight ?? 0) + 1);
}

/** Switches language, keeping what is under the header where it was (paragraphs above may change height). */
export function switchLanguage(language: Language) {
  if (document.documentElement.lang === language) return;
  const anchor = readingAnchor();
  const before = anchor?.getBoundingClientRect().top;
  const root = document.documentElement;
  // Our own correction replaces native scroll anchoring for this one change, so they never stack.
  root.style.overflowAnchor = 'none';
  applyLanguage(language);
  if (anchor?.isConnected && before !== undefined) {
    const shift = anchor.getBoundingClientRect().top - before;
    if (Math.abs(shift) >= 1) window.scrollBy(0, shift);
  }
  requestAnimationFrame(() => root.style.removeProperty('overflow-anchor'));
}

export function mountLanguage(toggle: HTMLElement): () => void {
  const onClick = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-switch]') : null;
    if (button) switchLanguage(button.dataset.switch === 'ko' ? 'ko' : 'en');
  };
  toggle.addEventListener('click', onClick);
  return () => toggle.removeEventListener('click', onClick);
}
