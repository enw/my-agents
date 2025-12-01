# Blueberg Lite Design System

## Overview

The Blueberg Lite design system creates a dense, terminal-inspired interface optimized for power users. Inspired by Bloomberg Terminal's information-dense research console aesthetic, it prioritizes functionality and information density over decorative elements, with a deep-blue, amber-on-dark console aesthetic.

## Core Principles

### 1. Dense Information Display
- Compact spacing (2-12px scale)
- Maximum information per pixel
- No decorative whitespace
- Functional over beautiful

### 2. Dark-First with Amber Text
- Dark mode is the primary experience
- Amber text (#FFB000) for dark mode (Compaq Portable /// style)
- Soft, warm backgrounds for light mode
- High contrast for readability

### 3. Minimal Radii
- Small border radii (2-4px maximum)
- Sharp, functional corners
- No rounded pill shapes

### 4. Compact Typography
- Base font size: 13px
- Line height: 1.3 (tight)
- Font scale: 11px (xs) → 16px (xl max)
- Monospace for code/data

### 5. Fast Transitions
- All transitions: 100-180ms
- Kinetic easing functions
- No slow animations
- Immediate feedback

## Color Palette

### Dark Mode (Primary)

**Backgrounds (Deep Navy):**
- `--bg-base`: #020617 (near-black navy base)
- `--bg-elevated`: #02081F (slightly lighter panels)
- `--bg-subtle`: #050F24 (card backgrounds)
- `--bg-hover`: #071327 (hover states)
- `--bg-selected`: #0B1933 (selected items)

**Borders:**
- `--border-subtle`: #1E222B (subtle dividers)
- `--border-strong`: #2B3240 (stronger borders)

**Text (Amber - Compaq Portable /// style):**
- `--text-primary`: #FFB000 (bright amber)
- `--text-secondary`: #FFA500 (orange-amber)
- `--text-muted`: #CC8800 (darker amber)
- `--text-inverse`: #050608 (for text on light backgrounds)

**Accents:**
- `--accent-blue`: #3B82F6 (primary actions)
- `--accent-green`: #22C55E (success)
- `--accent-amber`: #FACC15 (warnings)
- `--accent-red`: #F97373 (errors)
- `--accent-purple`: #A855F7 (special)

### Light Mode (Secondary)

**Backgrounds:**
- `--bg-base`: #F5F5F0 (warm off-white)
- `--bg-elevated`: #FCFCF8 (light cream)
- `--bg-subtle`: #F0F0EB (warm gray)
- `--bg-hover`: #E8E8E3 (hover states)
- `--bg-selected`: #E0E0DB (selected items)

**Borders:**
- `--border-subtle`: #D8D8D3
- `--border-strong`: #C8C8C3

**Text:**
- `--text-primary`: #1A1A15 (dark text)
- `--text-secondary`: #3A3A35
- `--text-muted`: #6B6B66
- `--text-inverse`: #FFFFFF

**Accents:** (Same as dark mode)

## Spacing Scale (Compact)

- `--space-1`: 2px
- `--space-1.5`: 3px
- `--space-2`: 4px (micro)
- `--space-3`: 6px
- `--space-4`: 8px (default)
- `--space-5`: 10px
- `--space-6`: 12px

**Usage:**
- Padding: 4-8px typical
- Gaps: 2-4px between related items
- Margins: 6-12px for sections

## Typography Scale

### Font Stack
```
system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 
'Helvetica Neue', sans-serif
```

### Scale
- **xs**: 11px (labels, meta)
- **sm**: 12px (table headers, secondary text)
- **base**: 13px (body, list items)
- **lg**: 14px (section titles)
- **xl**: 16px (page title, max)

### Line Heights
- All text: 1.3 (tight, dense)
- Headings: 1.2 (tighter)

## Border Radius

- `--radius-xs`: 2px
- `--radius-sm`: 3px
- `--radius-md`: 4px (maximum)

**Usage:**
- Buttons: 3px
- Inputs: 3px
- Cards: 4px
- No large radii

## Shadows

- `--shadow-soft`: 0 8px 24px rgba(0, 0, 0, 0.45) (dark mode)
- `--shadow-soft`: 0 8px 24px rgba(0, 0, 0, 0.12) (light mode)

**Usage:**
- Modals only
- No card shadows
- No button shadows

## Component Specifications

### Buttons

**Primary:**
- Height: 28-30px
- Padding: 8px 12px
- Font: 12-13px, medium weight
- Background: accent-blue
- Text: text-inverse
- Border radius: 3px
- Hover: opacity 90% or darker shade

**Secondary:**
- Height: 28-30px
- Padding: 8px 12px
- Font: 12-13px, medium weight
- Background: transparent
- Border: 1px border-subtle
- Text: text-secondary
- Hover: bg-hover

**Danger:**
- Same as primary but accent-red

### Inputs

- Height: 28-30px
- Padding: 6px 10px
- Font: 13px
- Background: bg-subtle
- Border: 1px border-subtle
- Border radius: 3px
- Focus: border-accent-blue + ring

### Tables

- Row height: 30-32px
- Cell padding: 8px (px-2 py-1)
- Header: bg-subtle, text-muted, 12px
- Borders: 1px border-subtle between rows
- Hover: bg-hover
- Selected: bg-selected + left border accent

### Cards

- Background: bg-elevated
- Border: 1px border-subtle
- Padding: 8px (px-2 py-2)
- Border radius: 4px
- Hover: border-strong

### Command Palette

- Width: 640px
- Max height: 60vh
- Background: bg-elevated
- Border: border-strong
- Item height: 28px
- Footer: 12px text, muted

## Animation Guidelines

### Timing Functions

**Kinetic Ease Out** (most common):
```css
cubic-bezier(0.16, 1, 0.3, 1)
```

**Sharp Ease Out** (quick interactions):
```css
cubic-bezier(0.4, 0, 0.2, 1)
```

**Gentle Ease Out** (smooth transitions):
```css
cubic-bezier(0.25, 0.46, 0.45, 0.94)
```

### Durations

| Purpose | Duration | Easing |
|---------|----------|--------|
| Hover states | 100ms | ease-out |
| Standard transitions | 150ms | kinetic |
| Complex animations | 180ms | gentle |

## Implementation

### CSS Variables

All design tokens are defined as CSS variables in `app/globals.css`:

```css
:root {
  /* Light mode tokens */
  --bg-base: #F5F5F0;
  --text-primary: #1A1A15;
  /* ... */
}

.dark {
  /* Dark mode tokens */
  --bg-base: #050608;
  --text-primary: #FFB000;
  /* ... */
}
```

### Tailwind Integration

Tokens are mapped to Tailwind utilities in `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      'bg-base': 'var(--bg-base)',
      'text-primary': 'var(--text-primary)',
      // ...
    },
    spacing: {
      '1': 'var(--space-1)',
      '2': 'var(--space-2)',
      // ...
    }
  }
}
```

### Usage Examples

**Button:**
```tsx
<button className="h-9 px-3 text-sm bg-accent-blue text-text-inverse rounded-sm">
  Click me
</button>
```

**Input:**
```tsx
<input className="h-9 px-2.5 py-1 border border-border-subtle rounded-sm bg-bg-subtle text-text-primary" />
```

**Table Row:**
```tsx
<tr className="h-8 hover:bg-bg-hover">
  <td className="px-2 py-1 text-xs text-text-primary">Content</td>
</tr>
```

## Density Mode

The system supports a compact density mode via `[data-density="compact"]`:

- Smaller button heights (28px → 24px)
- Tighter spacing
- Smaller fonts
- Reduced padding

## Accessibility

- Maintain WCAG AA contrast ratios
- Keyboard navigation throughout
- Focus indicators visible
- Screen reader support
- Respect `prefers-reduced-motion`

## Dark Mode Default

Dark mode is the default experience. Light mode is available but secondary. The amber text in dark mode provides excellent readability and reduces eye strain for extended use.
