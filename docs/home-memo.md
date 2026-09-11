# Homepage memo

The optional memo section sits after the editorial archive and before the
footer on the homepage (`#memo`). It uses an Astro component and a small native
custom element; no React runtime, external images, API, storage or analytics
are added. The compact round has eight pairs of original inline SVG symbols.
The board is created only when the reader chooses to deal cards.

Time starts with the first card and stops at the final pair. A move is a pair
of valid picks. Repeated, already matched and third-card picks are ignored.
Reset and element disconnection cancel pending callbacks and timers. Scores
are session-only and disappear on navigation/reload. Elapsed time includes
time spent in background tabs.

Native buttons support Tab, Enter and Space; arrows move across the four-column
board, with Home/End for its endpoints. Hidden cards do not expose symbol names
through accessible labels. Results use a polite live region; the ticking clock
does not. Reduced-motion preferences disable card transitions. Without
JavaScript, the decorative preview and explanatory fallback remain visible.

Run `npm run check` for type checks, content checks, game-engine regression
tests and the Node build. Browser acceptance should cover first-card timing,
match/mismatch resolution, fast third clicks, reset during a mismatch, a full
win, replay, keyboard operation and a 390px layout. Do not equate local browser
acceptance with deployment: verify the actual release separately.

Local acceptance on 2026-09-11: all 180 tests and the Node build passed.
Chrome completed all eight pairs in 14 moves; the timer froze at the final
pair. Reset during a mismatch and replay after winning cleared the board and
score. ArrowRight moved focus and Enter revealed the focused card. At 390px,
cards measured about 78px square with no horizontal overflow. The unstarted
board remained absent from the DOM and its clock remained at zero.
