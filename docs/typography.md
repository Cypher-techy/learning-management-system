# ELIMU BORA Typography System

## Font architecture

Elimu Bora uses three self-hosted variable font families. They are bundled through Fontsource packages and imported once in `src/app/layout.tsx`; the application does not depend on a runtime Google Fonts stylesheet.

| Role | Family | Primary uses |
| --- | --- | --- |
| Display / interface emphasis | Plus Jakarta Sans Variable | Brand wordmark, headlines, section headings, dashboard headings, navigation, buttons, card titles and labels |
| Reading / interface text | Inter Variable | Paragraphs, course descriptions, lessons, forms, tables, notifications, statistics and long-form learning content |
| Technical | JetBrains Mono Variable | Certificate references, payment references, M-Pesa receipts, audit targets, system-generated IDs and code |

The CSS custom properties are `--font-display`, `--font-sans` and `--font-mono`. Tailwind exposes them as `font-display`, `font-sans` and `font-mono`.

## Weights

Only these weights should be used in product UI:

- `400` — normal reading text
- `500` — secondary emphasis and interface labels
- `600` — navigation, card headings, subheadings and strong inline emphasis
- `700` — major headings and important figures
- `800` — major marketing display headlines only

Do not introduce `900` or use bold as a substitute for hierarchy.

## Type scale

Reusable classes are defined centrally in `src/app/globals.css`, mirrored as Tailwind font-size tokens in `tailwind.config.ts`, and wrapped by semantic components in `src/components/Typography.tsx`.

| Token / component | Desktop target | Notes |
| --- | --- | --- |
| `.type-display` / `Display` | 64–76 px fluid range (capped at 76 px) | Landing hero only |
| `.type-h1` / `H1` | 48–56 px fluid range (capped at 56 px) | Major public-page headings |
| `.type-h2` / `H2` | 36–42 px fluid range | Public section headings |
| `.type-h3` / `H3` | 28–32 px fluid range | Dashboard page titles and major content sections |
| `.type-h4` / `H4` | 22–24 px fluid range | Dashboard section headings |
| `.type-h5` / `H5` | 18–20 px fluid range | Card and panel headings |
| `.type-lead` / `Lead` | 18 px | Introductions and supporting statements |
| `.type-body` / `Body` | 16 px | Default interface text |
| `.type-body-sm` / `BodySmall` | 14 px | Compact interface and dashboard copy |
| `.type-caption` / `Caption` | 13 px | Metadata and explanatory microcopy |
| `.type-technical` / `Technical` | 13 px mono | References, IDs and receipts |

Buttons, navigation and form labels use Plus Jakarta Sans at 500–600. Dashboard statistics use Inter with tabular numerals; they should be clear without becoming display type.

## Reading system

Use `.reading-prose` or the `Reading` component for lesson notes, course descriptions, articles, assignment instructions and other sustained reading.

- Measure: `--reading-measure: 72ch`
- Size: approximately 16–17 px
- Line height: `1.72`
- Paragraph and list rhythm are defined centrally
- Headings step down inside reading content rather than reusing dashboard display sizes

Use `.reading-column` when a lesson header, article and completion actions should share the same centred measure. Use `.assessment-copy` for quiz prompts and assignment instructions.

## Tables and data

- Data tables use Inter at 14 px with tabular lining numerals.
- Table headings use Plus Jakarta Sans at 12 px, 600 weight and restrained uppercase tracking.
- Add `data-numeric` to financial, statistical and progress header/data cells for right alignment.
- Long names and email addresses should wrap with `.type-wrap-anywhere` where truncation would hide essential information.

## Accessibility rules

- Use semantic heading order; visual size does not determine document hierarchy.
- Keep body copy at 16 px and compact copy at 14 px unless it is clearly metadata.
- Avoid essential text below 12 px.
- Do not rely on colour alone for status; status chips always include a text label.
- Keep letter spacing restrained. Uppercase labels should generally stay between `0.07em` and `0.16em`.
- Respect browser zoom by using relative units and avoiding fixed-height text containers.
- Preserve visible `:focus-visible` outlines for keyboard navigation.
- Existing `prefers-reduced-motion` handling remains in force for animated typography and scroll effects.

## Email and certificates

Email clients cannot reliably load the bundled web fonts, so transactional email uses the same family order with safe fallbacks: Plus Jakarta Sans/Inter for headings and copy, and JetBrains Mono/Consolas for verification codes.

Certificates use the shared brand wordmark/tagline classes, display hierarchy for the recipient and course, and `.type-technical` for the public certificate reference.

## Implementation checklist

When adding a surface:

1. Start with a component from `src/components/Typography.tsx` or a central `.type-*` class.
2. Use Tailwind tokens such as `text-body-sm`, `text-caption` or `text-h3` instead of arbitrary pixel sizes.
3. Use `.type-numeric` or `data-numeric` for values that must align.
4. Use `.type-technical` for generated identifiers and receipts.
5. Check mobile wrapping, 200% browser zoom behaviour, table overflow and long names/emails before release.
