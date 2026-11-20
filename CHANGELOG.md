# Changelog

## [1.0.3] – 2026-11-20

### Fixed
- First load no longer freezes the dashboard for several seconds when
  `header_cards` hosts cards such as auto-entities (#4). Hosted badges and
  cards are no longer mounted in the first render. They wait for a painted
  frame and Home Assistant's first state flush (at most 10 s), then mount one
  per idle slot (`requestIdleCallback`, timer fallback for Safari), toolbar
  items before overflow-menu cards.
- Overflow-menu cards still mount without the menu being opened: the bell
  counts their chips and stays hidden while that count is 0. The bell and the
  toolbar items appear once all hosted cards are mounted, a moment later than
  before, with their final count.

### Changed
- `labels` chips now look like Mushroom entity chips as they render in the
  menu today (height 36px, icon 18px, radius 18px, bold 0.3em text, stacked
  with 2px gap, transparent background) (#6). `--mush-chip-*` theme variables
  apply as they do for Mushroom. `chip_style: list` keeps the old full-width
  rows.
- `labels` chips are grouped by label in config order, newest first inside a
  group, like auto-entities with one include rule per label.

### Added
- `?hc_perf=1` on the dashboard URL adds `performance.measure` entries
  `hc:paintHosted` (whole async mount, including `loadCardHelpers`),
  `hc:hostedGate` and `hc:mountHosted:<id>`. Off by default.
