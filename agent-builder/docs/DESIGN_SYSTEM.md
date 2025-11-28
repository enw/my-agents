# Hyperminimal Kinetic Design System

## Overview

The Hyperminimal Kinetic design system emphasizes clean, minimal surfaces with generous whitespace, smooth physics-inspired animations, and intentional motion that makes the interface feel alive and responsive.

## Core Principles

### 1. Minimal Surfaces, High Whitespace
- Clean, uncluttered interfaces
- Generous padding and margins (minimum 1.5rem spacing)
- Focus on content with ample breathing room
- Subtle borders over heavy shadows

### 2. One Accent Color Per View
- Each view/section has a single, consistent accent color
- Accent colors are used sparingly for emphasis
- Primary accent: Blue-600 (#2563EB)
- Status colors: Green (success), Red (error), Yellow (warning)

### 3. Components Morph Rather Than Pop
- Transitions should feel smooth and natural
- Elements transform/morph their shape/size rather than appearing/disappearing
- Use scale, opacity, and transform properties together
- Avoid sudden pop-ins or harsh transitions

### 4. Soft, Physics-Inspired Motion (Under 180ms)
- All animations complete in under 180ms for responsiveness
- Use easing functions that feel natural (ease-out, cubic-bezier)
- Animations should feel like they have momentum
- Common durations:
  - Micro-interactions: 100ms
  - Standard transitions: 150ms
  - Complex animations: 180ms (maximum)

### 5. Cards and Insights Animate with Glide + Fade
- Entrance animations combine translateY (glide) with opacity (fade)
- Stagger animations for lists/cards (50ms delay between items)
- Exit animations should be quick and clean (fade out with slight scale down)

### 6. Geometric Typography with Hierarchy via Scale
- Use geometric, clean font stacks
- Hierarchy established through font size, not weight
- Consistent scale: base (16px), small (14px), large (18px), xl (24px), 2xl (32px)
- Line heights: 1.5 for body, 1.2 for headings

## Color Palette

### Neutrals
- **Background (Light)**: #FFFFFF
- **Background (Dark)**: #0A0A0A
- **Surface (Light)**: #FFFFFF
- **Surface (Dark)**: #1A1A1A
- **Border (Light)**: #E5E7EB
- **Border (Dark)**: #374151

### Text
- **Foreground (Light)**: #171717
- **Foreground (Dark)**: #EDEDED
- **Muted (Light)**: #6B7280
- **Muted (Dark)**: #9CA3AF

### Accent (Single Per View)
- **Primary**: #2563EB (Blue-600)
- **Primary Hover**: #1D4ED8 (Blue-700)
- **Primary Light**: #DBEAFE (Blue-100)

### Status Colors
- **Success**: #10B981 (Green-500)
- **Error**: #EF4444 (Red-500)
- **Warning**: #F59E0B (Amber-500)

## Spacing Scale

Generous whitespace is fundamental to the design system:

- **xs**: 0.25rem (4px)
- **sm**: 0.5rem (8px)
- **base**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)
- **3xl**: 4rem (64px)
- **4xl**: 6rem (96px)

Minimum spacing between elements: 1.5rem (24px)

## Typography Scale

### Font Stack
```
Font Family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif
```

### Scale
- **xs**: 0.75rem (12px) - Labels, captions
- **sm**: 0.875rem (14px) - Secondary text
- **base**: 1rem (16px) - Body text
- **lg**: 1.125rem (18px) - Emphasized body
- **xl**: 1.5rem (24px) - Subheadings
- **2xl**: 2rem (32px) - Headings
- **3xl**: 2.5rem (40px) - Large headings

### Hierarchy
- Use size, not weight, to establish hierarchy
- Regular weight (400) for body
- Medium weight (500) for emphasis
- Bold (700) only for critical information

## Animation Guidelines

### Timing Functions

**Standard Ease Out** (most common):
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

### Common Animations

#### Glide + Fade Entrance
```css
@keyframes glide-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Morph (Scale + Opacity)
```css
@keyframes morph-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

#### Fade Out
```css
@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
```

### Animation Durations

| Purpose | Duration | Easing |
|---------|----------|--------|
| Hover states | 100ms | ease-out |
| Standard transitions | 150ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Complex animations | 180ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Entrance animations | 180ms | cubic-bezier(0.25, 0.46, 0.45, 0.94) |

## Component Patterns

### Cards
- Minimal borders (1px solid, neutral color)
- Generous padding (1.5rem minimum)
- Subtle hover effects (border color change, slight scale)
- Glide + fade entrance animation
- No shadows (or very subtle if necessary)

### Buttons
- Border-first design (outlined by default)
- Fill on hover/active
- Morph animation on state change
- Minimum 150ms transition
- Generous padding (0.75rem 1.5rem)

### Tables
- Clean borders between rows
- Hover state: background color change
- Sortable headers: subtle background change + icon animation
- Checkboxes: smooth checked state transition

### Forms
- Inputs with subtle borders
- Focus state: border color change + slight scale
- Labels float/shrink on focus
- Smooth validation feedback

## Implementation Guidelines

### CSS Custom Properties
Use CSS variables for all design tokens:
- Colors
- Spacing
- Typography
- Animation durations
- Easing functions

### Tailwind Configuration
- Extend default theme with design system tokens
- Custom animation utilities
- Custom spacing scale
- Custom color palette

### Component Animation Rules
1. Always use `transform` and `opacity` (GPU-accelerated)
2. Never animate `width`, `height`, `top`, `left` (layout properties)
3. Use `will-change` sparingly and remove after animation
4. Prefer CSS transitions over JavaScript animations when possible
5. Use framer-motion for complex, orchestrated animations

### Accessibility
- Respect `prefers-reduced-motion` media query
- Provide immediate feedback (no animation delay)
- Ensure animations don't block critical interactions
- Maintain keyboard navigation during animations

## Dark Mode

All design tokens must have dark mode equivalents:
- Backgrounds become darker
- Text becomes lighter
- Borders become more subtle
- Accent colors remain consistent
- Maintain sufficient contrast ratios (WCAG AA minimum)

## Examples

### Card Component
```tsx
<div className="card">
  {/* Content */}
</div>
```

Styles:
- Border: 1px solid neutral
- Padding: 1.5rem
- Entrance: glide-fade-in 180ms
- Hover: border color + slight scale (1.01) 150ms

### Button Component
```tsx
<button className="btn-primary">
  Click me
</button>
```

Styles:
- Border: 2px solid accent
- Padding: 0.75rem 1.5rem
- Transition: all 150ms ease-out
- Hover: background fill + scale (1.02)
- Active: scale (0.98)

### Input Component
```tsx
<input className="input" />
```

Styles:
- Border: 1px solid neutral
- Padding: 0.75rem 1rem
- Transition: border-color 150ms, transform 150ms
- Focus: border accent color + scale (1.01)
