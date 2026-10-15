# Styling guide

The game uses plain CSS. Edit the file that owns the component you want to change.
`index.html` loads the stylesheets directly, in the order below; no build step is needed.
The root `style.css` remains a compatibility entry point with the same ordered imports.

## Where to make changes

| File | Owns | Selector examples |
| --- | --- | --- |
| `tokens.css` | Shared colors and shadow | `:root`, `--gold`, `--panel2` |
| `base.css` | Box sizing, body background and default font | `*`, `body` |
| `layout.css` | Page width, padding and shared grids | `main`, `.grid`, `.two` |
| `components/navigation.css` | Header, branding, tabs and resource bar | `.top`, `.eyebrow`, `.brand-mark`, `.tabs`, `.resources` |
| `components/buttons.css` | Shared buttons and their variants | `button`, `.small`, `.primary`, `.danger-btn` |
| `components/panels.css` | Panel shells, headings and tags | `.panel`, `.section-head`, `.tag` |
| `components/character-cards.css` | Agent/recruit cards, portraits, stats and history | `.agent`, `.recruit`, `.portrait`, `.stats`, `.big-stats`, `.chronicle` |
| `components/meters.css` | Progress and special meters | `.meter`, `.special-meter` |
| `components/ability-list.css` | Character ability lists | `.ability-list` |
| `components/contract-cards.css` | Contracts, warrants and requirements | `.quest`, `.wanted-card`, `.requirement-box`, `.deploy-row` |
| `components/inventory.css` | Material cards, equipment and character collections | `.material`, `.inventory-summary`, `.equipment-card`, `.pathway-inventory` |
| `components/modals.css` | Overlay, modal shell, close button and modal form defaults | `.overlay`, `.modal`, `.close` |
| `components/party-selector.css` | Assignment rows, choices and solo bonus | `.assign-row`, `.choice`, `.party-solo-bonus` |
| `components/pathway-preview.css` | Pathway picker, introductions and sequence previews | `.pathway-picker`, `.preview-ability`, `.path-choice` |
| `components/battle-simulator.css` | Simulator controls, results and damage table | `.sim-unit`, `.sim-result`, `.balance-table` |
| `components/battle-log.css` | Battle messages, outcomes and playback controls | `.battle-log-wrap`, `.b-row`, `.battle-toolbar`, `.battle-ticker-viewport` |
| `components/dungeon-arena.css` | Battlefield scenery, character and companion formations, sprites and floating gauges | `.gm-dungeon-arena`, `.gm-character-formation`, `.gm-companion-formation`, `.combat-sprite-img`, `.gm-float-gauge` |
| `components/feedback.css` | Loading, toast, warning and empty states | `.loading-screen`, `.toast`, `.warning`, `.empty` |
| `utilities.css` | Small shared helpers | `.muted`, `.compact`, `.full`, `.gold-note`, `.dead` |

## Editing conventions

- Keep a component's default rules, states, media queries and animations in its owning file.
- Keep existing class names so the JavaScript-generated HTML continues to work.
- Format declarations on separate lines. Use descriptive comments rather than version-history headings.
- Put shared button styles in `buttons.css`; put component-specific button styles in that component's file.
- Keep grouped selectors within one owner. If a shared rule targets multiple components, repeat its declarations in each owning file.
- Repeated selectors inside a file currently preserve the original cascade. Inspect their combined behavior before consolidating them; shorthands and `!important` affect the result.
- The battlefield uses one responsive formation layout. Its source-image geometry is set by the UI; keep character and companion sizes square and let formations wrap without clipping deployed units.
- Add a new component stylesheet to both `index.html` and the compatibility imports in `style.css`, in the same order, and update this map.
- Relative `url(...)` paths resolve from the stylesheet's location. A component stylesheet should use `../../data/assets/...` for assets under `data/assets/`.

## Preserving appearance

When editing, check the affected component at desktop and narrow mobile widths, including hover/selected states and modal variants.
Image defaults are shared by battlefield, campaign and dossier portraits; verify all three when changing those defaults.
