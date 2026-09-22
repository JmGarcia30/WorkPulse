---
name: WorkPulse
description: An editorial public landing system for clear, connected workforce operations.
colors:
  warm-ivory: "#EEEBDD"
  muted-sand: "#D8B4A0"
  deep-maroon: "#7A0000"
  black: "#000000"
  white: "#FFFFFF"
  soft-white: "#F8F7F3"
  muted-gray: "#6B6B6B"
  divider: "#DED9D0"
  semantic-green: "#18794E"
typography:
  display: { fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif', fontSize: "clamp(3rem, 7vw, 6rem)", fontWeight: 760, lineHeight: 0.98, letterSpacing: "-0.04em" }
  headline: { fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif', fontSize: "clamp(2.25rem, 4.5vw, 4rem)", fontWeight: 730, lineHeight: 1.04, letterSpacing: "-0.035em" }
  body: { fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif', fontSize: "1.0625rem", fontWeight: 400, lineHeight: 1.65 }
  label: { fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif', fontSize: "0.75rem", fontWeight: 700, lineHeight: 1.4, letterSpacing: "0.03em" }
rounded: { control: "8px", product: "12px", final-cta: "16px" }
spacing: { control: "8px", compact: "12px", content: "24px", section-min: "100px", section-max: "130px" }
components:
  button-primary: { backgroundColor: "{colors.deep-maroon}", textColor: "{colors.white}", typography: "{typography.label}", rounded: "{rounded.control}", padding: "12px 20px", height: "44px" }
  button-secondary: { backgroundColor: "{colors.soft-white}", textColor: "{colors.black}", typography: "{typography.label}", rounded: "{rounded.control}", padding: "12px 20px", height: "44px" }
  product-surface: { backgroundColor: "{colors.white}", textColor: "{colors.black}", rounded: "{rounded.product}", padding: "24px" }
  final-cta: { backgroundColor: "{colors.deep-maroon}", textColor: "{colors.white}", rounded: "{rounded.final-cta}", padding: "32px" }
---

# Design System: WorkPulse

## Overview

**Creative North Star: "The Editorial Operations Ledger"**

The public WorkPulse landing page is a warm, editorial identity for a serious workforce product. Warm ivory and muted sand make the page considered and human; deep maroon and black provide authority, while white, soft white, gray, and paper dividers keep information legible. The approved distinctive hero remains the anchor, followed by varied editorial rows that explain the real product without turning every capability into a card.

This public palette is scoped to `src/app/page.tsx`, `landing-navbar.tsx`, and `landing.module.css`. Authenticated app and business surfaces outside the public landing may retain their existing semantic/application tokens. Product truth and clear distinction between available and planned capabilities remain durable requirements.

**Key Characteristics:**

- Warm ivory canvas with deep maroon authority and muted sand punctuation.
- Segoe UI Variable throughout; hierarchy comes from scale, weight, measure, and spacing.
- Hero-led storytelling followed by editorial rows, sparse cards, and thin rules.
- Semantic green reserved for actual status meaning, never decoration.
- Subtle, one-shot reveals with a complete reduced-motion fallback.

## Colors

The public palette is intentionally small: warm neutrals carry the page, maroon carries brand action, black carries text, and green carries status only.

### Primary

- **Deep Maroon** (#7A0000): primary public action, key emphasis, and final CTA field.

### Secondary

- **Muted Sand** (#D8B4A0): restrained editorial accent and supporting punctuation.

### Neutral

- **Warm Ivory** (#EEEBDD): public landing canvas.
- **Soft White** (#F8F7F3): alternate surface and control field.
- **White** (#FFFFFF): product previews, scrolled navbar, and inverse text.
- **Black** (#000000): primary copy and high-contrast marks.
- **Muted Gray** (#6B6B6B): supporting copy and metadata.
- **Divider** (#DED9D0): thin rules between rows and sparse cards.
- **Semantic Green** (#18794E): status meaning only.

### Named Rules

**The Warm Ledger Rule.** Keep this palette scoped to the public landing; application tokens outside it are not silently reinterpreted.

**The Semantic Green Rule.** Green appears only when it communicates a real status.

## Typography

**Display Font:** Segoe UI Variable (with Segoe UI and system sans-serif fallbacks)  
**Body Font:** Segoe UI Variable (with Segoe UI and system sans-serif fallbacks)

**Character:** One variable sans family gives WorkPulse an exact, contemporary voice. Large statements are confident and tightly tracked; body copy is calm and readable.

### Hierarchy

- **Display:** 48-96px responsive, heavy and tightly tracked; reserved for the hero statement.
- **Headline:** 36-64px responsive; introduces each editorial proposition.
- **Body:** 16-18px with approximately 1.65 line-height.
- **Label:** 12px, bold, and lightly tracked for navigation, metadata, controls, and status context.

## Layout

Use a centered 1200-1280px content container with responsive gutters. Preserve the distinctive hero, then alternate below-hero editorial rows, open product explanations, and sparse cards. Use thin dividers for rhythm. Major sections use 100-130px vertical spacing; controls and product surfaces use 8-12px corners and compact internal spacing. The final CTA uses a 16px radius.

The navbar is sticky: transparent over the hero, then white with a border and subtle shadow after the hero enters the reading flow. Rows stack responsively while preserving reading order and tappable actions.

## Elevation & Depth

The editorial page is flat by default. Dividers, tonal contrast, and whitespace do structural work. Use only a subtle shadow on the scrolled navbar and restrained elevation for genuine product previews; sparse content cards should not become floating tiles.

**The Earned Depth Rule.** A shadow must explain what is floating, never decorate a section.

## Shapes

Controls and compact product surfaces use restrained 8-12px corners. The final CTA may use 16px. Prefer 1px divider rules to enclosing borders. Avoid oversized rounded containers and decorative pills; reserve pills for genuine standalone statuses.

## Components

### Buttons

- **Primary:** Deep maroon with white type, 44px minimum height, and 8px corner.
- **Secondary:** Soft white or white field with black text and divider border.
- **Hover / Focus:** Small color or position change with a visible, high-contrast focus indicator.

### Cards / Product Surfaces

Sparse white or soft-white surfaces use 8-12px corners, a 1px divider, and generous whitespace. Shadow only genuine product previews.

### Navigation

Transparent and borderless over the hero. After the hero, the sticky navbar becomes white with a divider border and subtle shadow. Links remain compact, high-contrast, and keyboard accessible.

### Editorial Rows

Below-hero rows pair a clear proposition with product evidence or a sparse supporting surface. Vary alignment and density while retaining the shared container, thin rules, and 100-130px rhythm.

### Motion

Use subtle one-shot reveals for editorial rows and navbar state changes. Under `prefers-reduced-motion: reduce`, remove reveals and transitions while keeping all content and state visible.

## Do's and Don'ts

### Do:

- **Do** use #EEEBDD as the public canvas and #7A0000 as the primary action color.
- **Do** preserve the distinctive hero, then use editorial rows, thin dividers, and sparse product cards.
- **Do** keep the public container between 1200px and 1280px and sections between 100px and 130px.
- **Do** use semantic green only for real statuses.
- **Do** preserve existing application/business tokens outside the public landing scope.
- **Do** honor reduced-motion preferences.

### Don't:

- **Don't** reintroduce the former navy/teal landing palette.
- **Don't** turn every feature into a card, use heavy shadows, or wrap editorial content in oversized rounded frames.
- **Don't** use green as an accent, gradient, or decoration.
- **Don't** fabricate proof, metrics, logos, or capabilities.
- **Don't** make motion necessary for comprehension.
