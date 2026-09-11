# Homepage memo

The optional memo section sits after the editorial archive and before the
footer on the homepage (`#memo`). It uses an Astro component and a small native
custom element; no React runtime, external images, API, storage or analytics
are added. The full round has 40 cards: twenty pairs of original inline SVG
symbols, matching the board size used by the companion sites.
The board is created only when the reader chooses to deal cards.

Time starts with the first card and stops at the final pair. A move is a pair
of valid picks. Repeated, already matched and third-card picks are ignored.
Reset and element disconnection cancel pending callbacks and timers. Scores
are session-only and disappear on navigation/reload. Elapsed time includes
time spent in background tabs.

Native buttons support Tab, Enter and Space; arrows use the actual CSS column
count: eight on desktop, five on tablet and four on mobile, with Home/End for
the endpoints. Hidden cards do not expose symbol names
through accessible labels. Results use a polite live region; the ticking clock
does not. Staggered dealing, stable two-sided card flips, a matched-pair glow,
progress track and a completed-board highlight provide finite feedback without
permanent looping motion. Reduced-motion preferences disable all game
animations and transitions. The complete preview reserves board space. Without
JavaScript, the decorative preview and explanatory fallback remain visible.

Run `npm run check` for type checks, content checks, game-engine regression
tests and the Node build. Browser acceptance should cover first-card timing,
match/mismatch resolution, fast third clicks, reset during a mismatch, a full
win, replay, keyboard operation and a 390px layout. Do not equate local browser
acceptance with deployment: verify the actual release separately.

The engine regression suite checks 40 cards, twenty distinct names and paths,
exactly two copies of each symbol, shuffle integrity, input locking, full-round
completion, frozen time and independent resets. Repeat browser acceptance
after changes to the board or responsive styles; historical eight-pair release
acceptance is not evidence for this expanded version.
