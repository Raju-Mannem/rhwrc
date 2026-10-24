# Gridbricks Design System

## 1. Visual Philosophy: Apple-Inspired Analytical Workspace

The visual aesthetic balances the refinement of a high-end consumer product with the technical density of an institutional trading terminal:
- **Restraint Over Decoration**: Zero fluorescent glows, neon borders, or frivolous animations.
- **Subtle Depth**: Fine 1px hairline borders (`rgba(0, 0, 0, 0.07)` in light, `rgba(255, 255, 255, 0.08)` in dark) and soft elevation shadows.
- **Information Density**: Tabular numerals, disciplined 4px/8px spacing rhythm, and clear typography hierarchy.

---

## 2. Color Palette & Semantic Tokens

### Core Surfaces & Typography
| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--bg-app` | `#fbfbfa` | `#090a0f` | Application canvas background |
| `--bg-surface` | `#ffffff` | `#12141c` | Cards, tables, drawers |
| `--text-primary` | `#18181b` (zinc-900) | `#f4f4f5` (zinc-100) | Headings, primary metrics |
| `--text-secondary`| `#52525b` (zinc-600) | `#cbd5e1` (slate-300)| Subtitles, table labels |
| `--text-muted` | `#71717a` (zinc-500) | `#94a3b8` (slate-400)| Explanations, timestamps |

### Domain Semantic Chart Tokens
| Semantic Role | Light Hex | Dark Hex | Visual Meaning |
|---|---|---|---|
| **Forecast Series** | `#0284c7` (sky-600) | `#38bdf8` (sky-400) | Selected eligible day-ahead forecast |
| **Actual Series** | `#0d9488` (teal-600) | `#2dd4bf` (teal-400) | Actual metered wind generation (Elexon) |
| **Overforecast (+)**| `#ea580c` (orange-600)| `#fb923c` (orange-400)| $F - A > 0$ (Surplus prediction) |
| **Underforecast (-)**| `#4f46e5` (indigo-600)| `#818cf8` (indigo-400)| $F - A < 0$ (Deficit prediction) |
| **Zero Baseline** | `#94a3b8` (slate-400)| `#64748b` (slate-500)| Perfect accuracy balance line |

---

## 3. Typography Hierarchy

- **Font Family**:
  - Sans-Serif: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif`
  - Monospace (timestamps, numbers, identifiers): `"SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace`
- **Tabular Numerals**: Enforced via `.tabular-nums` (`font-variant-numeric: tabular-nums`) across all metrics, tables, and tooltips to guarantee vertical column alignment.
- **Heading Scale**:
  - Page Titles: `text-2xl font-bold tracking-tight`
  - Section Headings: `text-sm font-semibold tracking-tight`
  - Metric Values: `text-2xl font-bold tracking-tight font-mono`
  - Tabular Content: `text-xs font-mono`

---

## 4. Accessibility (WCAG 2.2 AA)

- **Color Independence**: Every error state pairs color with an explicit sign (`+` or `-`), directional label (`Overforecast (+)` / `Underforecast (-)`), or descriptive icon.
- **Keyboard Navigation**:
  - Global Command Menu: Triggered with `⌘K` or `Ctrl+K`. ESC key dismisses modals and drawers.
  - Heatmap cells and table rows support keyboard focus and click actions.
- **Focus Rings**: Accessible focus indicators (`focus-visible:ring-2 focus-visible:ring-blue-500/40`).
- **Screen Reader Support**: Svg charts include descriptive headings, text labels, and an adjacent full HTML data table alternative.
