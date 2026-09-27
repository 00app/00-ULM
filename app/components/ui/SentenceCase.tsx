'use client'

import { useEffect } from 'react'

/**
 * Sentence case for every heading and piece of supporting copy, whatever case it was authored
 * or generated in (hand-written lowercase house voice, Title Case, model output). Copy reaches
 * the screen from dozens of files plus database and API text, so fixing it per string doesn't
 * hold — this normalises at the one place they all end up: the DOM.
 *
 * Rules (capitalise only, never lowercases — names, acronyms and units are left alone):
 *   1. The first letter of an element's text is capitalised…
 *   2. …unless it continues the previous sibling of the same tag (headlines the Zone reveals
 *      line by line: "we've found 6 things," / "that could save you £518 and" is one sentence).
 *   3. Any letter after `. `, `? ` or `! ` inside the element is capitalised, except after a
 *      single-letter abbreviation ("e.g. ").
 * Labels, buttons and badges are excluded — they are uppercase by design. Input placeholders get
 * rule 1 (typed values are the user's own).
 */
const TEXT_SELECTOR = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'figcaption',
  '.zz-h1', '.zz-h2', '.zz-h3', '.zz-h4', '.zz-page-title', '.profile-question-headline',
  '.card-headline', '.question-text', '.zz-headline', '.solo-focus-hero',
  '.solo-focus-recommendation-headline',
].join(',')

const SKIP_SELECTOR = [
  'select', 'script', 'style', 'code', 'pre',
  '[contenteditable="true"]', '[data-keep-case]',
  '.card-top-label', '.data-label', '.zz-label', '.circle-btn',
  '.profile-answer-btn', '.settings-circle-cta',
].join(',')

const CONTINUES = /[^.!?…:"”')\]]\s*$/

function capitaliseFirst(text: string): string {
  return text.replace(/^(\s*)([a-z])/, (_, ws: string, ch: string) => ws + ch.toUpperCase())
}

function capitaliseSentences(text: string): string {
  return text.replace(
    /(\b[\w£€$%)]+)([.!?]+)(\s+)([a-z])/g,
    (all, word: string, punct: string, space: string, ch: string) =>
      word.length === 1 && /[a-z]/i.test(word) ? all : `${word}${punct}${space}${ch.toUpperCase()}`,
  )
}

/**
 * React attaches a fiber to every host element it has claimed. Editing text under an element
 * React hasn't hydrated yet makes it throw a hydration mismatch and rebuild the tree, so those
 * are skipped until a later pass (hydration renders are synchronous, so a fiber on the element
 * means its pass has finished).
 */
function isHydrated(el: Element): boolean {
  for (const key in el) {
    if (key.startsWith('__reactFiber$')) return true
  }
  return false
}

function normalise(el: Element): void {
  if (!isHydrated(el) || el.closest(SKIP_SELECTOR)) return
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let first = true
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const before = node.nodeValue ?? ''
    if (!before.trim()) continue
    let after = capitaliseSentences(before)
    if (first) {
      first = false
      const prev = el.previousElementSibling
      const continuesPrevious =
        prev !== null && prev.tagName === el.tagName && CONTINUES.test(prev.textContent ?? '')
      if (!continuesPrevious) after = capitaliseFirst(after)
    }
    if (after !== before) node.nodeValue = after
  }
}

export default function SentenceCase() {
  useEffect(() => {
    let frame = 0
    const run = () => {
      frame = 0
      document.querySelectorAll(TEXT_SELECTOR).forEach(normalise)
      document.querySelectorAll<HTMLInputElement>('input[placeholder]').forEach((input) => {
        const next = capitaliseFirst(input.placeholder)
        if (isHydrated(input) && next !== input.placeholder) input.placeholder = next
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    // Boundaries that hydrate later change no DOM, so the observer alone would never revisit them.
    const settle = window.setInterval(schedule, 300)
    const stopSettling = window.setTimeout(() => window.clearInterval(settle), 8000)
    window.addEventListener('load', schedule)
    return () => {
      observer.disconnect()
      window.clearInterval(settle)
      window.clearTimeout(stopSettling)
      window.removeEventListener('load', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return null
}
