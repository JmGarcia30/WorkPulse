---
name: WorkPulse
description: An editorial B2B SaaS design system for connected workforce operations.
colors:
  institutional-navy: "#17324d"
  white: "#ffffff"
  operational-teal: "#167d77"
  landing-off-white: "#f7f8f8"
  cool-canvas: "#f5f6f7"
  quiet-surface: "#eef1f3"
  teal-tint: "color-mix(in srgb, #167d77 4%, white)"
  soft-border: "#d9dee3"
  strong-border: "#aeb8c2"
  ink: "#142033"
  muted-ink: "#5f6b78"
  success: "#18794e"
  warning: "#9a6700"
  danger: "#b42318"
  info: "#245b9e"
typography:
  display:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    fontSize: "clamp(3.5rem, 6.2vw, 5.5rem)"
    fontWeight: 760
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    fontSize: "clamp(2.5rem, 4.2vw, 3.75rem)"
    fontWeight: 730
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    fontSize: "1.5625rem"
    fontWeight: 740
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 750
    lineHeight: 1.4
    letterSpacing: "0.03em"
rounded:
  mark: "8px"
  control: "8px"
  fragment: "10px"
  status: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section-compact: "78px"
  section-default: "104px"
  section-wide: "132px"
components:
  button-primary:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
    height: "46px"
  product-surface:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.fragment}"
    padding: "32px"
  diagram-core:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.white}"
    rounded: "{rounded.fragment}"
    padding: "16px"
  status-available:
    textColor: "{colors.success}"
    typography: "{typography.label}"
  status-planned:
    textColor: "{colors.warning}"
    typography: "{typography.label}"
---

# Design System: WorkPulse

## Overview

**Creative North Star: "The Institutional Operating Ledger"**

WorkPulse feels like a trustworthy operational record made legible: calm, connected, and exact without becoming bureaucratic. Its public visual language is product-led editorial B2B SaaS: a 56-88px opening statement, generous reading space, a large credible dashboard showcase, varied section rhythm, and structured diagrams that explain how people, modules, and organizational boundaries relate.

The landing page is light without feeling sterile. An off-white canvas, white fields, and occasional low-chroma teal-tinted sections create pacing while institutional navy establishes authority and operational teal signals connection and focus. Product truth leads the composition; decoration, spectacle, and unsupported proof do not.

**Key Characteristics:**

- Calm institutional authority with modern SaaS clarity.
- A large employee-record dashboard showcase that makes the product tangible in the hero.
- Lifecycle, module, AI, and tenant explanations built from product surfaces, nodes, rules, and branches.
- Off-white, white, and subtle teal-tint surfaces that vary the reading rhythm.
- Restrained navy and teal accents with semantic color reserved for real meaning.
- Purposeful CSS-only motion with a complete reduced-motion fallback.
- Explicit 1440px desktop, 768px tablet, and 390px mobile compositions.

## Colors

The palette pairs authoritative navy and operational teal with paper-light surfaces and unambiguous semantic states.

### Primary

- **Institutional Navy:** The authoritative field for primary actions, the central workforce-record node, compact brand marks, and high-contrast calls to action.

### Secondary

- **Operational Teal:** The connective accent for focus, lifecycle progress, diagram icons, underlines, and selective emphasis.

### Tertiary

- **Success, Warning, Danger, and Info:** Semantic colors communicate state only. Success distinguishes implemented or approved states; warning identifies planned or pending work; danger marks destructive or failed states; info supports neutral system messaging.

### Neutral

- **Landing Off-white:** The public-page ground and header surface.
- **White:** The main content field, dashboard and portal surfaces, footer, FAQ rows, and inverse foreground.
- **Cool Canvas and Quiet Surface:** Shared product surfaces retained for application screens and secondary rails.
- **Teal Tint:** A four-percent operational-teal wash on white, used as a full-width section band rather than a card fill.
- **Soft Border:** Default separators and component outlines.
- **Strong Border:** Structural rules, diagram connectors, and emphasized dividers.
- **Ink:** Primary text and high-priority labels.
- **Muted Ink:** Supporting copy, metadata, and secondary navigation.

### Named Rules

**The Semantic Restraint Rule.** Navy carries authority, teal carries connection, and status colors carry state; none are decorative fill.

**The Paper-Light Surface Rule.** Pace public pages with off-white, white, and subtle teal-tint fields. Do not introduce warm paper tones, glass effects, or large saturated panels.

## Typography

**Display Font:** Segoe UI Variable (with Segoe UI and system sans-serif fallbacks)  
**Body Font:** Segoe UI Variable (with Segoe UI and system sans-serif fallbacks)  
**Label Font:** Segoe UI Variable (with Segoe UI and system sans-serif fallbacks)

**Character:** One variable sans family creates a continuous institutional voice. Tight, heavy display text carries conviction; open body leading and compact labels keep operational information readable.

### Hierarchy

- **Display:** Heavy, tightly tracked, and limited to the landing statement; it scales from 56px to 88px on desktop, 54-76px on tablet, and 44-58px on mobile.
- **Headline:** Large section statements with slightly relaxed leading, balanced line wrapping, and a 40-60px desktop scale.
- **Title:** Compact 25px lifecycle, module, and diagram headings with moderate negative tracking.
- **Body:** Regular-weight explanation at 17-18px on wide screens and 16px on mobile, with generous 1.65-1.75 leading.
- **Label:** Compact bold utility text for navigation, controls, metadata, and diagram annotations; uppercase is reserved for terse status or eyebrow labels.

### Named Rules

**The One Family Rule.** Hierarchy comes from weight, size, measure, and spacing within the Segoe UI Variable stack, not from decorative font pairing.

**The Plainspoken Rule.** Headings describe operational outcomes directly; avoid hype, inflated claims, and vague transformation language.

## Layout

The public landing page uses a centered 1280px maximum width. At the 1440px reference width this leaves 80px margins; ordinary tablet gutters are 20px and mobile gutters become 16px. The 68px header is compact. The hero begins with an asymmetrical editorial split—statement and actions beside a compact lifecycle principle—then devotes the lower field to a centered, 1160px-wide product dashboard showcase with an attached AI-assistance note.

Section rhythm is intentionally varied rather than mechanically uniform: product-led split layouts alternate copy with employee-record and self-service surfaces; full-width lifecycle and AI bands use ruled sequences; tenant, security, and trust sections use branches, rows, or grids; and the FAQ pairs a sticky introduction with a native disclosure list. Vertical spacing ranges from roughly 84-110px in compact bands to 120-145px in expansive sections. White and teal-tint bands alternate with the off-white canvas while content remains aligned to the same 1280px grid. The page resolves into a dark navy final CTA before the light footer base.

At 1023px and below, navigation becomes a disclosure panel and major two-column sections stack. The 768px reference is a spacious single-column tablet composition; the hero principle moves below the headline while the product showcase retains useful scale. Below 768px, the 390px reference uses 16px gutters, full-width actions, a narrower dashboard rail, a single visible record panel, a vertical lifecycle, single-column AI steps, stacked security and trust rows, a non-sticky FAQ introduction, and a vertically stacked final CTA.

Connected structures use line-based layouts instead of unrelated cards. The lifecycle is a horizontal track on desktop and a vertical timeline on mobile. The module network remains an open radial field, the AI sequence becomes a downward reading path, and tenant boundaries remain a ruled stack.

**The Connected Structure Rule.** When modules describe one record or process, show their relationship with shared rules, branches, or sequence, not a grid of detached feature cards.

**The Reference Width Rule.** Judge the landing page at 1440px, 768px, and 390px; no reference width may introduce horizontal page overflow or break the intended reading order.

## Elevation & Depth

WorkPulse is flat at the page and section level. Depth comes from tonal fields, one-pixel dividers, open space, and carefully elevated product UI. Shadows are reserved for genuine product elevation and overlays: the large hero dashboard, attached AI note, employee-record panel, self-service portal, and mobile navigation. They must not spread into ordinary content blocks, FAQ rows, trust cells, or open diagrams.

### Shadow Vocabulary

- **Mobile Navigation Overlay** (`0 18px 35px rgba(23, 50, 77, 0.10)`): Separates the expanded navigation from page content.
- **Hero Product Showcase** (`0 22px 42px rgba(23, 50, 77, 0.10)`): Gives the large dashboard preview credible product elevation.
- **Product Panel** (`0 18px 48px rgba(23, 50, 77, 0.07)`): Lifts the employee-record and self-service surfaces from the page plane.
- **Attached Product Note** (`0 15px 38px rgba(23, 50, 77, 0.10)`): Separates the AI-assistance annotation where it overlaps the showcase.

### Named Rules

**The Earned Elevation Rule.** Sections and diagrams remain unboxed. Use shadow only when a real product surface or overlay must visibly sit above the page plane.

## Shapes

The public system uses restrained geometry: 8px corners for controls, navigation items, logos, dashboard internals, and ordinary marks; 9px for the compact profile avatar; and 10px for elevated product shells, the network core, and the final CTA. Full pills are limited to very small status or tenant-accent indicators. One-pixel rules define most structure.

**The Eight-to-Ten Rule.** Public landing elements stay within an 8-10px corner range. Do not wrap whole sections or open diagrams in oversized rounded frames.

## Components

### Buttons

- **Shape:** Restrained 8px corners with a 46px landing-page height; shared application controls retain a 44px minimum.
- **Primary:** Institutional navy with white type, 10px by 17px padding, and bold 14px labels.
- **Hover / Focus:** Hover lifts by one pixel and active presses by one pixel. Keyboard focus uses a solid 3px operational-teal outline, a 4px offset, and a white separation ring.
- **Secondary:** A translucent-white or white field with a strong neutral border and ink text; it remains subordinate to the primary action.

### Status Labels

- **Style:** Landing statuses are compact typographic labels embedded in diagrams and rows, not decorative chips.
- **State:** Implemented or available maps to success; planned maps to warning. The shared application status pill remains valid where a compact standalone state needs a container.

### Cards / Containers

- **Corner Style:** Product shells and the network core use 10px corners; controls, product internals, annotations, and marks use 8px.
- **Background:** White dashboard and portal surfaces sit over the off-white page; section-scale content uses white or teal-tint bands.
- **Shadow Strategy:** The hero dashboard and genuine product panels receive restrained cool-navy shadows; diagrams and editorial content stay flat.
- **Border:** Product surfaces use a one-pixel perimeter; structural information uses rules and connectors rather than extra shells.
- **Internal Padding:** Product panels range from 18-32px according to viewport; section content relies on whitespace rather than generic card padding.

### Inputs / Fields

- **Style:** The shared public field uses a white surface, one-pixel soft border, 8px corner, and 44px minimum height.
- **Focus:** Shift the border to the tenant or operational accent and add a low-opacity two-pixel outline.
- **Error / Disabled:** Use semantic danger for errors; disabled actions retain their structure and reduce opacity.

### Navigation

Desktop navigation uses compact bold links with muted ink, 32px spacing, and a simple underline on hover. At 1023px and below it becomes a native disclosure control. The panel opens beneath the 68px header as a full-width white layer with 46px rows and the documented overlay shadow.

### Open Diagrams

Lifecycle, employee-record, AI decision, tenant-boundary, and roadmap explanations share a common grammar: thin neutral connectors, navy for the authoritative core, teal for connective cues, and semantic status text. They do not sit inside a shared card shell. Responsive changes preserve meaning and reading order before preserving geometry.

### FAQ and Final CTA

The FAQ is a two-column editorial section: a sticky introduction at desktop and a ruled native `details` list with 72-76px summary rows. The first answer may be open by default, and the plus glyph rotates once when disclosure state changes. The final CTA is a 10px-radius navy field with white and outlined actions; it is the page's only large dark band and stacks copy above full-width actions on mobile.

### Motion

Motion is CSS-only, one-shot, and enhancement-only. Initial hero copy, principle, dashboard, and attached note enter once over 600-800ms with a restrained ease-out curve. View-timeline reveals progressively move sections and draw lifecycle rules only where supported; FAQ answers animate only when opened, and no element moves continuously. Hover and active feedback lasts 160-220ms. Under `prefers-reduced-motion: reduce`, all landing animations are removed, transforms reset, and transitions disabled; content remains complete without motion.

## Do's and Don'ts

### Do:

- **Do** use navy for authority, teal for connection, and semantic colors only for real states.
- **Do** alternate off-white, white, and subtle teal-tint section fields to create a varied editorial rhythm.
- **Do** explain product relationships with open lifecycle, network, sequence, and boundary diagrams.
- **Do** lead with the real-feeling dashboard showcase, then vary section structures rather than repeating a feature-card grid.
- **Do** use the ruled FAQ and dark final CTA to close the editorial narrative clearly.
- **Do** keep landing actions 46px high, shared controls at least 44px high, and focus visibly outlined.
- **Do** distinguish implemented capabilities from planned work in both language and status styling.
- **Do** verify the public landing composition at 1440px, 768px, and 390px.
- **Do** treat CSS motion as optional enhancement and preserve the complete reduced-motion path.

### Don't:

- **Don't** use glass, heavy ambient shadows, or decorative media on the public landing page; reserve tonal color mixing for subtle fields.
- **Don't** fabricate customer logos, testimonials, performance metrics, or other proof.
- **Don't** fragment a connected process into an excessive collection of bordered cards.
- **Don't** place open diagrams inside oversized rounded frames.
- **Don't** replace the dashboard-led hero with abstract floating fragments or a decorative journey illustration.
- **Don't** turn labels and metadata into decorative pills; reserve pills for standalone semantic states.
- **Don't** exceed 10px corners on ordinary public landing elements.
- **Don't** make motion necessary for comprehension or leave continuous motion active under reduced-motion preferences.
