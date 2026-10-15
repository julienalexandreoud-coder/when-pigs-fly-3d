// Markup for the When Pigs Fly logo (styles in css/logo.css). Shared by the
// launch screen and the store-cover renderer.

export const WING_SVG = `<path d="M70 40 C62 14 40 2 6 4 C15 10 15 15 11 19 C22 19 26 23 19 29 C30 29 34 34 26 40 C38 40 42 46 35 52 C50 55 62 50 70 40 Z"
  fill="#ffffff" stroke="#141014" stroke-width="4" stroke-linejoin="round"/>
  <path d="M62 37 C54 22 40 13 22 11" fill="none" stroke="#bfe6ff" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M58 44 C50 36 42 32 30 31" fill="none" stroke="#bfe6ff" stroke-width="3" stroke-linecap="round"/>`;

const SPARK = `<path d="M12 0 L15 9 L24 12 L15 15 L12 24 L9 15 L0 12 L9 9 Z" fill="#fff36b" stroke="#141014" stroke-width="2" stroke-linejoin="round"/>`;

// A curly pig tail that hangs off the last letter of PIGS.
const TAIL = `<path d="M4 30 C14 30 20 22 16 14 C12 6 2 10 6 17 C10 24 24 22 28 10 C30 4 34 2 38 4"
  fill="none" stroke="#141014" stroke-width="12" stroke-linecap="round"/>
  <path d="M4 30 C14 30 20 22 16 14 C12 6 2 10 6 17 C10 24 24 22 28 10 C30 4 34 2 38 4"
  fill="none" stroke="#ff8cc0" stroke-width="6.5" stroke-linecap="round"/>`;

export function logoHTML() {
  return `
    <span class="l-moon" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="l-ribbon"><span class="lw l-when" data-t="WHEN">WHEN</span></span>
    <span class="l-pigs-row">
      <span class="lw l-pigs" data-t="PIGS">PIGS</span>
      <svg class="tail" viewBox="0 0 42 36" aria-hidden="true">${TAIL}</svg>
    </span>
    <span class="l-fly-row">
      <svg class="wing l" viewBox="0 0 72 58" aria-hidden="true">${WING_SVG}</svg>
      <span class="lw l-fly" data-t="FLY">FLY</span>
      <svg class="wing r" viewBox="0 0 72 58" aria-hidden="true"><g transform="translate(72 0) scale(-1 1)">${WING_SVG}</g></svg>
      <svg class="spark" viewBox="0 0 24 24" aria-hidden="true">${SPARK}</svg>
    </span>`;
}
