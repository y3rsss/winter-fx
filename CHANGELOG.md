# Changelog

## 0.2.0 (not released yet)

- `snow()` takes `shape: "crystal"`, which draws the flakes as thin six-armed crystals and small clumps that sway and turn as they fall. Dots stay the default.
- `snow()` is 2.4 kB minified and compressed, up from 1.6 kB, with either shape.

## 0.1.0 (2026-11-24)

First release, with three effects:

- `snow()`: snowflakes falling over the page, in three depth layers.
- `garland()`: a string of twinkling lights across the top of the page.
- `frost()`: ice crystals that grow in from the edges of the screen.

Each effect returns a function that removes it, checks its settings when called, and follows the visitor's reduced motion setting.
