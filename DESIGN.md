# Design System — Social Mirror

## Product Context
- **What this is:** A personality reveal engine where friends play a game and AI synthesizes the gap between self-perception and friend-perception into shareable personality portraits
- **Who it's for:** Friend groups (4-8 people), playing together at parties, hangouts, or via group chat
- **Space/industry:** Social game meets personality assessment. Competitors: Dimensional (solo, serious), Gas/Hype (anonymous, dead), Jackbox (fun, ephemeral)
- **Project type:** Mobile-first web app, also displayed on shared TV/projector screens

## Aesthetic Direction
- **Direction:** Spotify Wrapped Energy — bright, warm, celebration-forward, shareable
- **Decoration level:** Expressive — bold gradients, colorful fills, celebration moments
- **Mood:** Like opening your year-in-review personality stats. Fun, warm, slightly surprising. Makes you want to screenshot and share. "Oh wow, look what my friends said about me."
- **Reference vibe:** Spotify Wrapped, Instagram Stories, personality quiz results you'd actually share

## Typography
- **Display/Hero:** Outfit (900/800) — bold, rounded, high-energy. Used for the Social Mirror wordmark, portrait reveals, biggest surprise numbers. Feels celebratory, not clinical.
- **Body:** Outfit (400/500) — same family for cohesion. Clean at small sizes, works great on mobile.
- **Data/Scores:** Geist Mono — tabular-nums for trait scores and gap numbers. Monospace makes data feel precise.
- **Loading:** Google Fonts: `Outfit:wght@400;500;600;700;800;900` + self-hosted Geist Mono via CDN

### Scale
| Level | Size | Weight | Use |
|-------|------|--------|-----|
| hero | 48-64px | 900 | Social Mirror wordmark, biggest surprise numbers |
| h1 | 32-36px | 800 | Player names on portrait cards |
| h2 | 24px | 700 | Section titles, question text |
| h3 | 18px | 600 | Card roles, sub-headers |
| body | 15-16px | 400 | Portrait narrative, descriptions |
| small | 13px | 500 | Labels, metadata |
| caption | 11-12px | 600 | Uppercase labels, tags |
| data | 13-32px | 600 | Geist Mono, trait scores |

## Color
- **Approach:** Expressive — color is a primary design tool, bold and warm
- **Background:** `#F5F0EB` (warm cream, not stark white)
- **Surface:** `#FFFFFF` (clean white cards)
- **Surface border:** `#EEEBE6` (subtle warm border)
- **Primary text:** `#1A1A1A` (near-black)
- **Muted text:** `#666666`
- **Accent gradient:** `linear-gradient(135deg, #FF4D6A, #FF8A5C, #FFD166)` (coral → orange → gold, the signature)
- **Accent solid:** `#FF4D6A` (coral-pink, for icons, links, role labels)
- **Gap positive:** `#00B894` (teal-green, "friends rate you higher")
- **Gap negative:** `#FF4D6A` (coral, "perception gap")
- **Gap neutral:** `#999999`
- **Semantic:** success `#00B894`, warning `#FFB347`, error `#FF4D6A`, info `#4A9DFF`

### Dark Mode Strategy
For TV/present view and optional user preference:
- Background: `#121218`
- Surface: `#1C1C26`
- Text: `#FAFAFE`
- Muted: `#9896AB`
- Accent gradient stays the same (it pops on dark)
- Gap colors brighten slightly: positive `#00E5A0`, negative `#FF6B6B`

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — social experience, not a data app
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Card internal padding:** 24-32px
- **Card gap:** 16px
- **Section gap:** 40-48px

## Layout
- **Approach:** Card-based, single-column on mobile, two-column optional on tablet
- **Grid:** Single column mobile, max 2 columns at 768px+
- **Max content width:** 680px (focused, not sprawling)
- **Border radius:** sm: 8px (inputs, small elements), md: 12px (buttons), lg: 16px (cards), xl: 24px (feature cards, portraits), full: 9999px (pills, avatars)
- **TV/present view:** Cinematic single-focus. One portrait fills the screen. Bigger type, more whitespace.

## Motion
- **Approach:** Expressive at key moments, functional elsewhere
- **Rating slider:** Smooth drag, gradient fills as value increases
- **Mini-reveal gap bar:** 600ms ease-out slide from center outward
- **Portrait reveal:** 1s fade-up with slight scale (1.02 → 1.0), staggered trait bars
- **Biggest Surprise card:** 400ms scale-up entrance with gradient flash behind it
- **AI Hot Take:** 300ms slide-up
- **Confetti:** On high-compatibility scores and session end
- **Default transitions:** 200ms ease-out (hover, focus, state changes)
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(600-1000ms)

## Component Patterns
- **Buttons:** Pill-shaped (border-radius: full). Primary = gradient fill + glow shadow. Secondary = white + border. Ghost = transparent + accent border.
- **Cards:** White surface, subtle warm border, top gradient accent bar (4px) for portrait cards
- **Trait bars:** Rounded pill bars with gradient fill. Self-score as muted underlay, group-score as gradient overlay. Gap badge on the right.
- **Surprise card:** Full gradient background (coral → orange), white text, large numbers, dramatic.
- **Inputs:** White background, warm border, focus = accent border + subtle glow
- **Alerts:** Left-border accent bar, tinted background

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-13 | Initial design system created | /design-consultation. Spotify Wrapped energy chosen over dark/serious (v1), dark/neon (v2), glassmorphism, and retro arcade options. User wants fun, bright, shareable, celebration vibes. |
| 2026-04-13 | Light mode primary, dark mode for TV view | Party game played on phones (light mode readable in all conditions) + TV/projector (dark mode for impact in dim rooms) |
| 2026-04-13 | Outfit over Space Grotesk, Sora, Instrument Serif | Outfit's extra-bold weights feel celebratory and shareable. Serif felt too serious. Sans-serifs like Sora felt too corporate. |
| 2026-04-13 | Gradient as signature, not single accent color | The coral→orange→gold gradient IS the brand. It's on buttons, trait bars, surprise cards, the wordmark. Makes screenshots instantly recognizable. |
