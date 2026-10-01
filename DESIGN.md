# Design system

One place to change the look: **`packages/frontend/src/index.css`** (values) and **`packages/frontend/tailwind.config.js`** (names). Components only use the names, so a change here updates every page.

## Colour tokens
Defined for light and dark in `index.css` (`--ground`, `--surface`, `--ink`, `--accent`, `--ok`, `--warn`, `--crit`, `--nav*`). The studio accent and background colour set in Settings are written over these at runtime and adapt to the dark theme automatically.

## Layout tokens (fluid, phone to desktop)
| Token | Tailwind | Used for |
|---|---|---|
| `--gap` | `gap-gap` | space between cards, tiles, grid cells |
| `--gap-lg` | `gap-gap-lg` | space between sections and columns |
| `--card-pad` | `p-card` | padding inside cards |
| `--page-x` / `--page-y` | `px-page-x` / `pt-page-y` | page side and top padding |
| `--text-title` | `text-title` | page title |
| `--text-stat` | `text-stat` | big number on a tile |
| `--text-hero` | `text-hero` | banner headline |
| `--nav-w` | `w-nav`, `grid-cols-shell` | desktop sidebar width |
| `--header-h` | `h-header`, `grid-rows-shell` | top bar height |
| `--chat-w` | `w-chat`, `grid-cols-shell-chat` | chat pane width |
| `--control-h` | (base layer) | button and input height, larger on touch screens |

Every size uses `clamp()`, so it scales smoothly with the screen instead of jumping at breakpoints.

## Breakpoints
Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.
- Below `lg` the sidebar becomes a slide-in drawer opened from the menu button.
- Below 1250px the chat pane is hidden (it is still reachable from the Chats button).
- Below `sm` the top bar shows icons only.

## Rules for new UI
1. Use tokens (`gap-gap`, `p-card`, `text-title`) instead of fixed pixel values.
2. Grids start at one or two columns and add columns at `lg` or `xl`.
3. Wide tables sit inside `overflow-x-auto` (the `DataTable` component already does).
4. Colours come from tokens (`bg-surface`, `text-ink`, `text-accent-text`), never hex values.
