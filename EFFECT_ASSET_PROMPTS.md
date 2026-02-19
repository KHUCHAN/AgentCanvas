# AgentCanvas 이펙트 & 에셋 AI 생성 프롬프트 모음

**작성일:** 2026-02-19
**목적:** AgentCanvas 프로젝트에 필요한 모든 시각 에셋(이미지, GIF, Lottie, 아이콘)을 AI 이미지 생성 도구로 만들기 위한 프롬프트 모음

---

## 디자인 시스템 참조 (모든 프롬프트 공통)

```
DESIGN SYSTEM CONTEXT — ALWAYS INCLUDE THIS BLOCK:

Brand: "AgentCanvas" — AI agent orchestration canvas tool (VS Code extension)
Theme: Dark UI, developer tool aesthetic, n8n/Retool/Figma inspired
Background: Dark navy #181b20
Elevated BG: Dark gray #1f232a
Primary: Teal green #2fa184
Primary Light: Bright teal #3dd9a8
Secondary: Soft blue #4a87e8
Warning: Amber #d4a11e
Danger: Coral red #d95c4f
Foreground: Light gray #d7dce5
Style: Clean, geometric, minimal, vector-flat, single-weight lines
Agent Character Style: Cute & friendly — rounded shapes, big expressive eyes, small body-to-head ratio (chibi-esque). Think Slack's custom emoji bots or Discord's Clyde mascot. Approachable but still professional.
```

---

## 카테고리 1: 로고 & 브랜딩 (7종)

### LOGO-1. 메인 로고 (512×512 PNG, 투명)

```
A modern, minimalist logo for a developer tool called "AgentCanvas".

The logo combines two visual concepts:
1. A stylized canvas/artboard shape — a rounded rectangle with subtle grid dots inside, representing a node-based visual editor workspace
2. An abstract AI agent symbol — a small geometric brain or neural node icon placed at the center of the canvas, with 3-4 thin connection lines radiating outward to smaller circular nodes at the edges

Style: Clean vector flat design, geometric shapes only, no gradients. Single-weight line art with filled accent shapes.
Color: Teal green (#2fa184) as the primary color on a transparent background. The connection lines and outer nodes use a lighter teal (#3dd9a8). The central brain/agent symbol is solid teal.
Mood: Technical, precise, modern — like n8n or Figma's visual identity. Professional developer tool aesthetic, not playful or cartoonish.
No text in the image. Icon only. Perfectly centered. Clean edges suitable for scaling down to 28×28px.

Output: 512×512px, transparent PNG
```

### LOGO-2. 사이드바 콤팩트 아이콘 (56×56 PNG @2x, 투명)

```
A simplified, compact version of the AgentCanvas logo optimized for very small sizes (28×28px rendered, 56×56px source for retina).

Keep only the essential shape: a rounded square canvas outline with a single central neural node and 3 radiating connection lines. Remove all fine details. Use thick, bold strokes (2-3px at rendered size).

Color: Solid teal (#2fa184) on transparent background.
Style: Extremely minimal — must be instantly recognizable at 28px. Think macOS dock icon or VS Code activity bar icon level of simplicity.

Output: 56×56px, transparent PNG
```

### LOGO-3. VS Code 마켓플레이스 아이콘 (128×128 PNG)

```
The AgentCanvas logo placed on a dark navy (#181b20) rounded-rectangle background card.

The logo itself: teal (#2fa184) geometric canvas icon with neural node center and radiating connections. Centered with generous padding (~20px each side).

The background card has slightly rounded corners (16px radius). Subtle inner shadow for depth. No text.

Style: Professional developer tool marketplace icon. Reference: VS Code extension marketplace icon guidelines.

Output: 128×128px, dark navy background, PNG
```

### LOGO-4. 빈 캔버스 일러스트 (640×400 PNG, 투명)

```
An empty state illustration for a node-based canvas editor called "AgentCanvas".

Scene: A minimal, abstract illustration showing a dark workspace with a subtle dot grid pattern. In the center, 3-4 translucent ghost nodes (rounded rectangles) are connected by thin dashed lines, suggesting where the user will place their agent nodes. A large "+" icon or cursor arrow floats near one ghost node, inviting interaction.

Color palette:
- Ghost nodes: Very faint teal (#2fa184 at 15% opacity) with dashed teal borders
- Connection lines: Faint teal (#3dd9a8 at 20% opacity), dashed style
- Dot grid: Barely visible (#d7dce5 at 8% opacity)
- "+" icon: Brighter teal (#2fa184 at 60%)
- Background: Transparent

Mood: Inviting but not overwhelming. "Your canvas is ready — start building." Developer tool aesthetic.
Style: Flat vector, geometric shapes, no 3D, no illustration characters. Clean and modern.

Output: 640×400px, transparent PNG
```

### LOGO-5. 로딩/폴백 SVG (가변 크기)

```
A loading state logo for AgentCanvas in SVG format.

Design: The AgentCanvas canvas icon (rounded rectangle with neural node) but designed for animation:
- The central node has a circular "pulse ring" around it (single ring, 2px stroke)
- The 3 radiating connection lines are segmented (dashed) so they can animate as data flow
- The outer small nodes are simple circles

Color: Teal (#2fa184) for all elements. Lighter teal (#3dd9a8) for the pulse ring.
Background: None (transparent SVG)

Style: Clean vector paths, each element on a separate <g> layer for CSS animation targeting. Minimal complexity (~15-20 SVG path elements max).

The SVG should be designed so CSS keyframe animations can:
1. Pulse the central ring (scale 1 → 1.3 → 1, opacity 1 → 0 → 1)
2. Flow the dashed lines (stroke-dashoffset animation)
3. Fade the outer nodes in/out sequentially

Output: SVG, viewBox="0 0 120 120", all paths with class attributes
```

### LOGO-6. 파비콘 (32×32 PNG, 투명)

```
An ultra-simplified AgentCanvas favicon for browser tab display at 32×32px.

Keep only: A single rounded square with a dot in the center and 2 tiny line segments radiating outward. Maximum 3 shapes total.

Color: Solid teal (#2fa184) on transparent background.
Style: Must be perfectly crisp at 16×16px display size. Think GitHub's octocat simplified to just the head silhouette level of abstraction.

Output: 32×32px, transparent PNG
```

### LOGO-7. 노드 타입 아이콘 세트 (각 64×64 SVG, 6종)

```
A set of 6 node type icons for a developer tool canvas. Each icon represents a different type of node in an AI agent orchestration system.

All icons share: 64×64px viewBox, 2px stroke weight, rounded line caps, transparent background, centered design with 8px padding.

Icon 1 — SKILL (Color: Teal #2fa184):
Lightning bolt inside a rounded square. The bolt is simplified to 3 angular segments. Represents executable capabilities.

Icon 2 — RULE (Color: Amber #de9f30):
Document/scroll shape with a checkmark overlay. A rectangle with folded top-right corner, small checkmark in center. Represents configuration rules.

Icon 3 — AGENT (Color: Blue #4a87e8):
Cute, friendly robot face — a rounded square head with two large circular "eyes" (slightly different sizes for charm), a tiny curved smile line, and a small rounded antenna on top with a glowing tip. Chibi robot aesthetic — approachable, not intimidating. Think Slack bot emoji style.

Icon 4 — PROVIDER (Color: Muted blue #5875a4):
Cloud shape (3 overlapping circles forming cloud silhouette) with a small connection dot below connected by a thin line. Represents backend providers (GPT, Claude, Gemini).

Icon 5 — FOLDER (Color: Indigo #6d7fd8):
Classic folder shape — rectangle with tab on upper-left. Clean, geometric, slightly rounded corners. Represents file system organization.

Icon 6 — NOTE (Color: Gold #b98516):
Sticky note / memo pad — square with folded bottom-right corner. A few horizontal lines inside suggesting text content. Represents user annotations.

Style: Lucide/Feather icon aesthetic. Single-weight outline with occasional filled accent. Crisp, professional, consistent across the set.

Output: 6 individual SVG files, 64×64px viewBox each
```

---

## 카테고리 2: 상태 이펙트 — Task 실행 (10종)

### EFFECT-1. Task Running 펄스 (GIF, 120×120, 무한루프)

```
A looping animated pulse effect for indicating a running task in a dark UI developer tool.

Animation: A teal (#2fa184) circular ring expands outward from center, fading as it grows (opacity 100% → 0%). As one ring reaches the edge, a new ring starts from center. Smooth, continuous cycle. 2 rings visible simultaneously at any frame.

Background: Transparent
Duration: 1.5 seconds per cycle
Framerate: 24fps
Size: 120×120px

Style: Minimal, clean, not flashy. Subtle enough to not distract from code. Think VS Code's "syncing" indicator or GitHub Actions' running indicator. The rings are thin (2px) with soft anti-aliasing.

Output: Transparent GIF or Lottie JSON, looping
```

### EFFECT-2. Task 완료 체크마크 (GIF, 80×80, 1회 재생)

```
A one-shot animated checkmark drawing effect for task completion feedback.

Animation sequence (total 600ms):
1. (0-200ms) A teal (#2fa184) circle draws itself clockwise from top (stroke-dasharray animation)
2. (200-450ms) Inside the circle, a checkmark draws itself in two strokes — down-right then up-right — in bright teal (#3dd9a8)
3. (450-600ms) Brief subtle glow/flash on the circle, then settles to static

Background: Transparent
Size: 80×80px, centered
Stroke weight: 3px for circle, 3px for checkmark

Style: Satisfying, precise, not bouncy or playful. Professional completion indicator. Reference: Stripe's payment success animation level of polish.

Output: Transparent GIF or Lottie JSON, plays once
```

### EFFECT-3. Task 실패 X마크 (GIF, 80×80, 1회 재생)

```
A one-shot animated X-mark (failure) effect for task error feedback.

Animation sequence (total 500ms):
1. (0-150ms) A coral red (#d95c4f) circle draws itself quickly
2. (150-350ms) Inside the circle, an "X" draws itself — two diagonal strokes crossing
3. (350-500ms) Brief red flash/pulse, then subtle shake (2px left-right oscillation, 2 cycles), settles

Background: Transparent
Size: 80×80px, centered
Stroke weight: 3px

Style: Clear error indication without being alarming. Professional, not dramatic.

Output: Transparent GIF or Lottie JSON, plays once
```

### EFFECT-4. Task Blocked 경고 (GIF, 80×80, 무한루프)

```
A looping animated warning indicator for blocked/waiting tasks.

Animation: An amber (#d4a11e) triangle warning sign with "!" exclamation mark inside. The entire symbol gently pulses (scale 1.0 → 1.05 → 1.0, opacity 100% → 80% → 100%). Very slow, non-distracting pulse.

Background: Transparent
Duration: 2 seconds per cycle
Size: 80×80px

Style: Subtle, not alarming. Indicates "waiting for dependency" rather than "error". The amber color communicates caution, not danger.

Output: Transparent GIF or Lottie JSON, looping
```

### EFFECT-5. 프로그레스 바 shimmer (GIF, 400×8, 무한루프)

```
A looping shimmer/glow effect overlaid on a progress bar for running tasks.

Animation: A horizontal progress bar shape (400×8px, rounded ends). The bar is filled with teal (#2fa184). A diagonal highlight stripe (lighter teal #3dd9a8, 15% opacity) sweeps from left to right continuously, creating a shimmer effect like a loading bar.

The stripe is angled ~30° and is about 60px wide. It moves smoothly from left edge to right edge in 1.5 seconds, then loops.

Background: Transparent (only the bar shape is visible)
Size: 400×8px, rounded caps (4px radius)

Style: Smooth, subtle shimmer. Not a candy-stripe animation — more like a glass reflection moving across the surface. Reference: macOS progress bar shimmer.

Output: Transparent GIF, looping
```

### EFFECT-6. Build Team 생성 로더 (GIF, 200×200, 무한루프)

```
A looping loading animation for the "Build Your Agent Team" generation process.

Animation: Three cute chibi robot characters arranged in a triangle formation. Each robot has a round head, big expressive eyes, and a tiny body. They "wake up" in sequence — eyes light up one by one (agent 1 → agent 2 → agent 3 → repeat), and thin connection lines draw between them as they activate, suggesting a team forming.

The robots are slightly different:
- Robot 1 (top): Has a small crown/star antenna — the orchestrator (amber #e8a64a)
- Robot 2 (bottom-left): Has a wrench accessory — the coder (blue #4a87e8)
- Robot 3 (bottom-right): Has a magnifying glass — the tester (teal #2fa184)

Color:
- Robot outlines: Soft blue (#4a87e8) at varying opacity (active: 100%, inactive: 30%)
- Eyes: Bright teal (#3dd9a8) glow when active
- Connection lines: Teal (#2fa184), thin (1px), draw on/off
- Background: Transparent

Duration: 2 seconds per full cycle
Size: 200×200px

Style: Cute but professional. Chibi robot team forming. Think Discord loading animation meets Notion's cute illustrations.

Output: Transparent GIF or Lottie JSON, looping
```

### EFFECT-7. 노드 연결 데이터 흐름 (Sprite Sheet, 256×32, 8프레임)

```
A sprite sheet for animating data flow along edges (connection lines) between nodes.

8 frames showing a small light particle/dot moving along a horizontal line from left to right. Each frame shows the dot at a different position (evenly spaced across 256px width).

Frame details:
- The dot is teal (#3dd9a8), 6px diameter, with a soft glow (8px feathered edge)
- Behind the dot, a brief "trail" of fading teal (30px long, fading from 60% to 0% opacity)
- The line itself is NOT drawn (transparent) — only the moving dot and trail

Background: Transparent
Size: 256×32px total (each frame 32×32px)
Frames: 8

Style: Subtle, particle-like. Used as a CSS sprite animation on SVG edges. Reference: Figma's "flow" prototype animation indicators.

Output: Transparent PNG sprite sheet
```

### EFFECT-8. Schedule Now-Line 글로우 (GIF, 4×120, 무한루프)

```
A thin vertical glowing line animation for the "current time" indicator on a schedule timeline.

Animation: A vertical line (4px wide, 120px tall) that glows rhythmically:
- Base: Solid teal (#2fa184) center line (2px)
- Glow: Softer teal (#3dd9a8 at 40% opacity) halo around it (4px total width)
- Animation: The glow intensity pulses gently (opacity 30% → 50% → 30%), 2-second cycle

Background: Transparent
Size: 4×120px

Style: Subtle time indicator. Not distracting but clearly visible against dark background. Reference: Music production DAW playhead cursors.

Output: Transparent GIF, looping
```

### EFFECT-9. Drag & Drop 고스트 오버레이 (PNG, 280×80, 투명)

```
A translucent card "ghost" image used during drag-and-drop operations on kanban boards.

Design: A rounded rectangle card (280×80px) with:
- Background: Dark gray (#1f232a at 70% opacity)
- Border: Dashed teal (#2fa184 at 50% opacity), 1.5px, 6px dash pattern
- Interior: Two faint horizontal lines suggesting text (light gray at 20%), one shorter line below
- Subtle drop shadow: 0 8px 24px black at 30% opacity

Style: Clearly a "floating card" being moved. Semi-transparent so the drop target behind is visible. Professional drag feedback.

Output: 280×80px, transparent PNG
```

### EFFECT-10. 칸반 카드 완료 스탬프 (PNG, 48×48, 투명)

```
A small "DONE" completion stamp/badge overlaid on completed kanban cards.

Design: A circular badge (48×48px) with:
- Background: Teal (#2fa184) circle
- Foreground: White checkmark icon, bold, centered
- Optional: Very subtle "ring" border outside (lighter teal #3dd9a8, 1px)

Style: Clean, minimal badge. Not a literal rubber stamp — more like GitHub's green check badge or Slack's "completed" indicator.

Output: 48×48px, transparent PNG
```

---

## 카테고리 3: Empty State & Onboarding 일러스트 (5종)

### ILLUST-1. "팀 없음" 초기 화면 배경 (800×500 PNG, 투명)

```
An illustration for the empty state when no agent team has been created yet.

Scene: A charming dark workspace scene. In the center, a large translucent prompt input field outline glows softly in teal. Around it, 3 cute chibi robot characters sit in waiting positions — one is "sleeping" (eyes closed, small "zzz" bubbles), one is peeking curiously from behind a ghost card, and one is waving at the viewer. They're sitting on faint dashed-line "connection paths" that form a gentle arc between them.

The robots are small (about 60-80px each at this scale), positioned at the edges of where the team canvas will be. The overall composition draws the eye to the center prompt area.

Small decorative elements:
- Tiny floating sparkle particles (dots, 2-3px) in teal and blue, scattered sparsely
- A curved arrow pointing toward the prompt input, suggesting "start here"
- Subtle dot grid in background

Color: Primarily teal (#2fa184) and blue (#4a87e8) at low opacities (15-30%) on transparent background. Robot characters are slightly more opaque (40-50%) to be visible.
Size: 800×500px
Style: Cute-meets-professional. Think Notion's empty state illustrations or Linear's whimsical-but-clean style. The robots add personality without being childish.

Output: Transparent PNG
```

### ILLUST-2. "실행 기록 없음" (400×300 PNG, 투명)

```
An empty state illustration for when there are no run history entries.

Scene: A minimalistic timeline/log visualization with no entries. Three horizontal lines fade from left to right (representing empty log rows). A small clock icon with circular arrows (refresh/retry symbol) sits at center.

Color: Very muted teal (#2fa184 at 15-20%) and light gray (#d7dce5 at 10%) on transparent background
Size: 400×300px
Style: Ultra-minimal, barely-there aesthetic. Communicates "nothing here yet" without being sad or empty-feeling.

Output: Transparent PNG
```

### ILLUST-3. "스킬 없음" (400×300 PNG, 투명)

```
An empty state illustration for when an agent has no skills assigned.

Scene: A single agent card outline (rounded rectangle) in the center. Inside it, where skills would normally be listed, there are 3 dashed placeholder rectangles stacked vertically. A small "+" icon floats near the top placeholder, inviting the user to add skills.

Color: Blue (#4a87e8 at 15%) for the agent card, teal (#2fa184 at 20%) for the "+" icon, gray for placeholders
Size: 400×300px
Style: Clean wireframe-like illustration. Developer tool aesthetic.

Output: Transparent PNG
```

### ILLUST-4. "칸반 보드 비어있음" (600×400 PNG, 투명)

```
An empty state illustration for the kanban board before any tasks exist.

Scene: Three empty kanban columns side by side (labeled ghost areas for "To Do", "In Progress", "Done"). Each column is a tall rounded rectangle outline with dashed borders. The "To Do" column has a single ghost card dropping in from above (positioned slightly above the column with a downward arrow/motion trail).

Color:
- Column outlines: Light gray (#d7dce5 at 12%) dashed borders
- Ghost card: Teal (#2fa184 at 20%) with subtle downward arrow
- Column header text areas: Slightly brighter gray (#d7dce5 at 20%)

Size: 600×400px, transparent background
Style: Suggests the kanban structure without content. Inviting, not empty/sad.

Output: Transparent PNG
```

### ILLUST-5. "연결 에러" (320×240 PNG, 투명)

```
An illustration for connection error or backend unavailable state.

Scene: A simplified network/cloud icon with a disconnection indicator. A cloud shape (representing the backend) has a small "X" or broken connection symbol below it. A thin line from below (representing the client) reaches toward the cloud but has a gap/break in the middle.

Color:
- Cloud: Muted gray (#d7dce5 at 25%)
- Broken line: Coral red (#d95c4f at 40%) for the gap/break indicator
- Lower line: Teal (#2fa184 at 20%)

Size: 320×240px, transparent
Style: Abstract, geometric. Not sad/emotional — factual "connection lost" communication.

Output: Transparent PNG
```

---

## 카테고리 4: 배경 & 텍스처 (4종)

### BG-1. 캔버스 도트 그리드 (Tileable, 40×40 PNG)

```
A seamless tileable dot grid pattern for a dark UI canvas background.

Pattern: A single small dot (1.5px diameter) centered in a 40×40px tile. The dot is very subtle — light gray (#d7dce5) at 8% opacity on transparent background.

When tiled, this creates a uniform dot grid with 40px spacing — standard for node-based canvas editors like Figma, n8n, or React Flow.

Requirements:
- MUST be perfectly seamless when tiled horizontally and vertically
- Dot must be perfectly centered (20px, 20px)
- Anti-aliased edges on the dot
- Transparent background

Output: 40×40px, transparent PNG, seamless tile
```

### BG-2. 빌드 프롬프트 화면 그라디언트 (1200×800 PNG)

```
A subtle radial gradient background for the initial "Build Your Agent Team" prompt screen.

Design: On a dark navy (#181b20) base, a very soft radial gradient emanates from center:
- Center: Slightly lighter area (teal #2fa184 at 3-4% mixed into the navy)
- Edge: Pure dark navy #181b20

The effect is barely noticeable — just enough to draw the eye toward center where the prompt input will be placed. Like a very subtle spotlight.

Additional: Extremely faint dot grid pattern overlaid (dots at 5% opacity, 40px spacing) for depth.

Size: 1200×800px
Style: Atmospheric, not distracting. The gradient should be so subtle that users feel it subconsciously rather than consciously noticing it.

Output: PNG (not transparent — has solid dark background)
```

### BG-3. 헤더/상태바 노이즈 텍스처 (Tileable, 200×200 PNG)

```
A very subtle noise/grain texture overlay for UI header and status bar areas.

Pattern: Fine-grained noise (film grain style) with:
- Grain size: 1-2px
- Opacity: 3-5% white on transparent background
- Distribution: Uniform random, no clustering

When overlaid on dark UI elements (#1f232a), it adds tactile depth without being visible at a glance. Only noticeable on close inspection.

Requirements: Perfectly seamless when tiled. No visible repeat pattern.

Output: 200×200px, transparent PNG, seamless tile
```

### BG-4. 에이전트 카드 미묘한 그라디언트 (280×160 PNG)

```
A subtle gradient card background for agent node cards on the canvas.

Design: A rounded rectangle (280×160px, 12px radius) with:
- Base color: Dark elevated gray (#1f232a)
- Top edge: Very subtle lighter line (1px, #ffffff at 5% opacity) — simulating light from above
- Bottom: Slightly darker than base (#181b20 at bottom 20%)
- Overall: Barely perceptible top-to-bottom darkening gradient

This gives cards a very subtle "elevated surface" feel without being obviously gradient. Reference: VS Code's sidebar panels or macOS window titlebar subtle gradients.

Output: 280×160px, 12px corner radius, PNG (solid, not transparent)
```

---

## 카테고리 5: 마이크로 인터랙션 스프라이트 (6종)

### MICRO-1. 버튼 리플 이펙트 (Sprite Sheet, 320×40, 8프레임)

```
A sprite sheet for button click ripple effect animation.

8 frames showing a circular ripple expanding outward from center:
- Frame 1: Small teal (#2fa184) dot, 4px diameter, 50% opacity
- Frame 2-6: Circle expands progressively (8px → 16px → 28px → 36px → 40px diameter), opacity decreases (40% → 30% → 20% → 10% → 5%)
- Frame 7-8: Circle at full size, fading to 0% opacity

Each frame: 40×40px (8 frames = 320×40px total strip)
Background: Transparent
Stroke: None — filled circle with decreasing opacity

Style: Material Design ripple concept but teal-colored and more subtle/professional.

Output: 320×40px, transparent PNG sprite sheet
```

### MICRO-2. 토스트 알림 아이콘 세트 (PNG, 3종 × 24×24)

```
Three small notification icons for toast messages:

Icon A — INFO (Color: Teal #2fa184, 24×24px):
A circle with lowercase "i" inside. Clean, simple informational indicator.

Icon B — WARNING (Color: Amber #d4a11e, 24×24px):
A triangle with "!" exclamation inside. Standard caution indicator.

Icon C — ERROR (Color: Coral red #d95c4f, 24×24px):
A circle with "✕" cross inside. Clear error indicator.

All three: 2px stroke weight, rounded line caps, transparent background, same visual weight and style.

Style: Lucide/Feather icon consistency. Clean vector, no fill (outline only with accent color).

Output: 3 separate 24×24px transparent PNGs
```

### MICRO-3. 드래그 핸들 그립 (SVG, 12×20)

```
A small drag handle grip icon for draggable kanban cards and timeline tasks.

Design: 6 small dots arranged in a 2×3 grid pattern:
- Dot size: 2px diameter each
- Horizontal spacing: 6px center-to-center
- Vertical spacing: 6px center-to-center
- Total size: 12×20px

Color: Light gray (#d7dce5) at 40% opacity
Background: Transparent

Style: Standard drag handle pattern (like Trello/Notion card handles). Subtle, indicates draggability without being prominent.

Output: SVG, 12×20px viewBox
```

### MICRO-4. 핀 고정 아이콘 (SVG, 2종 × 16×16)

```
Two pin icons for pinning/unpinning task outputs:

Icon A — PINNED (Color: Teal #2fa184, 16×16px):
A pushpin shape, slightly tilted (15° right). Filled/solid to indicate active pinned state. The pin body is a rounded triangle, the stick is a thin line.

Icon B — UNPINNED (Color: Light gray #d7dce5 at 40%, 16×16px):
Same pushpin shape but outline only (not filled). Slightly more tilted (30° right) to suggest "loose/unfixed" state.

Both: 1.5px stroke weight, rounded line caps, transparent background.
Style: Minimal, functional. Reference: macOS Finder pin or Safari's pin tab icon.

Output: 2 separate SVGs, 16×16px viewBox each
```

### MICRO-5. 오케스트레이터 크라운 뱃지 (PNG, 20×20, 투명)

```
A small crown/leader badge icon for the Orchestrator agent in a team.

Design: A simplified geometric crown shape (20×20px):
- Three small upward-pointing triangles forming the crown top
- A horizontal band at the bottom connecting them
- A tiny circular "jewel" dot at the center peak

Color: Warm amber/gold (#e8a64a) — matching the orchestrator accent color in the design system
Background: Transparent

Style: Geometric, not ornate. Think emoji crown (👑) simplified to pure geometric shapes. Must be legible at 16px display.

Output: 20×20px, transparent PNG
```

### MICRO-6. 컨텍스트 미터 게이지 세트 (3종 × 48×48 PNG)

```
Three circular gauge/meter states for the context window usage indicator:

Gauge A — OK State (Color: Teal #2fa184):
A circular ring gauge, 75% filled. The filled portion is teal, the empty portion is dark gray (#1f232a). A small "✓" icon in the center.

Gauge B — WARNING State (Color: Amber #d4a11e):
Same circular ring gauge, 88% filled. The filled portion is amber, empty is dark gray. A small "!" icon in the center.

Gauge C — DANGER State (Color: Coral red #d95c4f):
Same circular ring gauge, 96% filled. The filled portion is coral red, empty is dark gray. A small "⚠" icon in the center. Subtle outer glow (red at 15% opacity, 4px feather).

All three: 48×48px, 4px ring width, transparent background, percentage fill is clockwise from top.

Style: Dashboard gauge aesthetic. Clean, informational. Reference: System monitoring tools (htop, Activity Monitor).

Output: 3 separate 48×48px transparent PNGs
```

---

## 카테고리 6: 엣지 & 커넥션 이펙트 (5종)

### EDGE-1. 엣지 타입별 패턴 (SVG, 7종 × 200×4)

```
Seven horizontal edge/line pattern SVGs for different relationship types on the canvas:

Edge A — CONTAINS (Teal #2fa184): Solid line, 2px width
Edge B — OVERRIDES (Amber #de9f30): Dashed line (8px dash, 4px gap), 2px width
Edge C — LOCATED_IN (Indigo #6d7fd8): Dotted line (2px dot, 4px gap), 2px width
Edge D — APPLIES_TO (Blue #4a87e8): Solid line, 1.5px width
Edge E — AGENT_LINK (Blue #4a87e8): Solid line with small arrowhead at end, 2px width
Edge F — DELEGATES (Amber #e8a64a): Dash-dot line (12px dash, 4px gap, 2px dot, 4px gap), 2px width
Edge G — INTERACTION (Purple #a86ee5): Solid line with diamond marker midpoint, 1.5px width

All: 200×4px, transparent background, horizontal, designed for SVG path stroke patterns.
Style: Clearly distinguishable even at small canvas zoom levels.

Output: 7 separate SVGs, each 200×4px
```

### EDGE-2. 엣지 선택 하이라이트 글로우 (PNG, 200×12, 투명)

```
A horizontal glow effect for selected/hovered edges on the canvas.

Design: A horizontal line (200×12px) with:
- Center: 2px solid teal (#2fa184) line
- Glow: 12px total height soft glow around the line (teal #3dd9a8 at 25% opacity, gaussian blur)

Background: Transparent
Size: 200×12px

Style: Subtle neon glow effect. Used as an overlay on active/selected edges. Reference: Figma's selected connector line glow.

Output: 200×12px, transparent PNG
```

### EDGE-3. 방향 화살표 마커 세트 (SVG, 4종 × 12×12)

```
Four small arrowhead markers for edge endpoints:

Arrow A — Standard (Teal #2fa184): Simple filled triangle pointing right, 12×12px
Arrow B — Diamond (Amber #de9f30): Small diamond shape (rotated square), 12×12px
Arrow C — Circle (Blue #4a87e8): Small filled circle, 8px diameter centered in 12×12px
Arrow D — Open (Purple #a86ee5): Open triangle (outline only, 2px stroke), 12×12px

All: 12×12px viewBox, designed for SVG <marker> definitions.
Style: Crisp at all zoom levels. Consistent line weight.

Output: 4 separate SVGs, 12×12px viewBox each
```

### EDGE-4. 의존성 흐름 파티클 (Lottie/GIF, 32×32, 무한루프)

```
A small animated particle that travels along dependency edges during task execution.

Animation: A tiny glowing dot (4px) with a short comet-like trail (12px long) moves from left to right across a 32×32px frame, then loops.

Color:
- Particle: Bright teal (#3dd9a8)
- Trail: Teal (#2fa184) gradient fading to transparent
- Glow: Subtle bloom around particle (8px, 20% opacity)

Duration: 0.8 seconds per traversal
Background: Transparent
Size: 32×32px

Style: Fast-moving, energetic. Represents data/dependency flowing between tasks. Like fiber optic light pulses.

Output: Transparent GIF or Lottie JSON, looping
```

### EDGE-5. 커넥션 생성 프리뷰 라인 (PNG, 200×4, 투명)

```
A dashed preview line shown while the user is dragging to create a new connection between nodes.

Design: A horizontal dashed line (200×4px):
- Color: White (#d7dce5) at 50% opacity
- Dash pattern: 8px dash, 6px gap
- Line width: 2px (centered in 4px height)
- End cap: Small circle (4px diameter) at right end suggesting "will connect here"

Background: Transparent

Style: Clearly a "pending/preview" connection, visually distinct from established edges. Reference: React Flow's default connection dragging line.

Output: 200×4px, transparent PNG
```

---

## 카테고리 7: 스케줄 뷰 전용 (4종)

### SCHED-1. 타임라인 배경 줄무늬 (Tileable, 120×40 PNG)

```
A seamless tileable background pattern for schedule timeline lanes.

Pattern: A horizontal stripe — top 39px is transparent, bottom 1px is a very faint horizontal line (#d7dce5 at 8% opacity). Creates subtle row separators when tiled vertically.

Tile size: 120×40px (40px = one lane height)
Background: Transparent

Output: 120×40px, transparent PNG, seamless vertical tile
```

### SCHED-2. 시간 그리드 마커 (Tileable, 60×40 PNG)

```
A seamless tileable pattern for time grid columns on the schedule timeline.

Pattern: A vertical line at the left edge (1px wide, #d7dce5 at 6% opacity), rest is transparent. Creates subtle time grid columns when tiled horizontally.

Tile size: 60×40px (represents one time unit width)
Background: Transparent

Output: 60×40px, transparent PNG, seamless horizontal tile
```

### SCHED-3. 스윔레인 에이전트 뱃지 (4종 × 32×32 PNG, 투명)

```
Four small agent avatar badges for schedule swimlane headers:

Badge A — Primary Agent (Blue #4a87e8): Circle with cute robot face — big round eyes, tiny smile, small antenna
Badge B — Orchestrator (Amber #e8a64a): Circle with cute robot face wearing a tiny crown tilted slightly
Badge C — Worker Agent (Teal #2fa184): Circle with cute robot face holding a tiny wrench
Badge D — QA/Tester (Purple #a86ee5): Circle with cute robot face wearing tiny round glasses

All: 32×32px, colored circle background, white chibi robot face inside, transparent outer background. Each robot has a unique personality through one accessory but shares the same base face shape (round head, big eyes, small smile).
Style: Adorable but legible at 24px. Think GitHub's Mona octocat variants or Slack's custom emoji bots.

Output: 4 separate 32×32px transparent PNGs
```

### SCHED-4. 태스크 블록 텍스처 세트 (4종 × 200×32 PNG)

```
Four task block background textures for different execution states on the schedule timeline:

Texture A — DEFAULT (Blue tint): Solid fill #4a87e8 at 15% opacity on transparent. Subtle.
Texture B — RUNNING (Teal tint): Solid fill #2fa184 at 18% opacity with very faint diagonal stripe pattern (45°, 1px stripes, 8px spacing, +5% opacity) suggesting activity/motion.
Texture C — DONE (Teal tint): Solid fill #2fa184 at 12% opacity. Slightly desaturated compared to running.
Texture D — FAILED (Red tint): Solid fill #d95c4f at 12% opacity with small diagonal cross-hatch pattern (1px, 12px spacing, +3% opacity) suggesting error.

All: 200×32px, rounded corners (8px radius), transparent background outside the rounded rect.
Style: Subtle status differentiation through color and texture. Not jarring.

Output: 4 separate 200×32px transparent PNGs
```

---

## 카테고리 8: 모달 & 오버레이 (3종)

### MODAL-1. 모달 백드롭 블러 (CSS용 참조, 코드)

```
NOTE: This is a CSS-only effect, not an image. Include for reference.

.modal-backdrop {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

No image asset needed — pure CSS implementation.
```

### MODAL-2. 커맨드 바 입력 글로우 (PNG, 600×56, 투명)

```
A glowing input field effect for the command bar (Cmd+K) overlay.

Design: A rounded rectangle (600×56px, 12px radius) with:
- Border: 1.5px solid teal (#2fa184)
- Glow: Outer glow — teal (#2fa184 at 20% opacity) feathered 8px outward
- Inner highlight: Top edge 1px line of lighter teal (#3dd9a8 at 15%)
- Interior: NOT filled (transparent center — the actual input field sits inside)

Background: Transparent
Size: 600×56px

Style: A "focused input field" glow effect. Draws attention to the command input. Reference: Raycast/Alfred command bar glow.

Output: 600×56px, transparent PNG
```

### MODAL-3. 스킬 위저드 단계 인디케이터 (SVG, 400×40)

```
A step indicator for the multi-step Skill Wizard modal.

Design: 4 circles (16px diameter each) connected by horizontal lines (2px, 40px long). Representing 4 wizard steps.

States shown in one SVG:
- Step 1 (completed): Solid teal (#2fa184) filled circle with white checkmark
- Step 2 (active): Teal (#2fa184) ring with teal fill, slightly larger (18px) with outer glow
- Step 3 (upcoming): Gray (#d7dce5 at 30%) ring, empty
- Step 4 (upcoming): Gray (#d7dce5 at 30%) ring, empty
- Connecting line Step1→Step2: Solid teal
- Connecting line Step2→Step3: Half teal (left half) + half gray (right half)
- Connecting line Step3→Step4: Gray

Size: 400×40px, centered vertically
Background: Transparent

Style: Clean wizard step indicator. Reference: Stripe's checkout step indicator.

Output: SVG, 400×40px viewBox, with class attributes on each element for CSS state switching
```

---

## 카테고리 9: 에이전트 캐릭터 에셋 (12종)

> **캐릭터 디자인 베이스 가이드**: 모든 에이전트 캐릭터는 동일한 기본 형태를 공유합니다 — 큰 둥근 머리(전체의 60%), 작은 몸통, 큰 동그란 눈 2개, 작은 미소, 짧은 안테나. 역할에 따라 악세서리와 표정만 다릅니다. 컬러풀하되 다크 UI 위에서 잘 보이도록 밝은 톤.

### CHAR-1. 에이전트 캐릭터 기본 세트 (8종 × 128×128 PNG, 투명)

```
A set of 8 cute chibi AI robot agent characters for a dark-themed developer tool UI. All robots share the same base design but have unique accessories for their role.

BASE DESIGN (shared by all 8):
- Head: Large rounded square (60% of total height), slightly wider than tall
- Eyes: Two big circular eyes with shiny highlight dots (like anime/Pixar eyes). The eyes are expressive and take up ~40% of the face area
- Mouth: Small, simple curved smile line
- Body: Tiny rounded rectangle body (25% of total height) below the head
- Arms: Short stubby arms, always in a characteristic pose
- Antenna: One small antenna on top with a glowing tip
- Proportions: Head-heavy chibi style, 2:1 head-to-body ratio
- Outline: Clean 2px dark outline for clarity on any background

VARIANT 1 — ORCHESTRATOR "리더" (Accent: Amber #e8a64a):
- Wears a tiny tilted crown on head
- Arms on hips (confident pose)
- Eyes are focused/determined (slight eyebrow lines)
- Small star sparkle near the crown
- Body color: Amber/gold tint

VARIANT 2 — CODER "코더" (Accent: Blue #4a87e8):
- Wears tiny rectangular glasses
- Holds a mini laptop/keyboard in one arm
- Eyes are concentrated (looking slightly down)
- Small code bracket symbols { } floating nearby
- Body color: Blue tint

VARIANT 3 — TESTER "테스터" (Accent: Purple #a86ee5):
- Holds a magnifying glass in one hand
- Has a small clipboard in other hand
- Eyes are wide and curious (looking through magnifying glass)
- Small checkmark and X symbols floating nearby
- Body color: Purple tint

VARIANT 4 — WRITER "작성자" (Accent: Teal #2fa184):
- Holds a tiny pencil/pen
- Has a small notepad
- Eyes are thoughtful (looking slightly up)
- Small text lines floating nearby
- Body color: Teal tint

VARIANT 5 — DESIGNER "디자이너" (Accent: Pink #e84a8a):
- Wears a tiny beret on head
- Holds a small paintbrush
- Eyes are dreamy/creative (slight sparkle)
- Small color palette dot nearby
- Body color: Pink tint

VARIANT 6 — DEVOPS "데브옵스" (Accent: Orange #e8764a):
- Wears a tiny hard hat
- Has a small wrench/gear accessory
- Eyes are alert/watchful
- Small cloud/server icon nearby
- Body color: Orange tint

VARIANT 7 — DATA "데이터" (Accent: Cyan #4ae8d4):
- Wears tiny round glasses (different from coder — rounder)
- Has a small chart/graph floating nearby
- Eyes are analytical (one slightly narrower)
- Small bar chart icon nearby
- Body color: Cyan tint

VARIANT 8 — GENERIC "기본" (Accent: Light gray #d7dce5):
- No special accessory — pure base robot
- Waving hand pose (friendly greeting)
- Eyes are happy/welcoming (slightly upturned)
- Small sparkle nearby
- Body color: Neutral gray with teal accent highlights

ALL: 128×128px each, transparent background, consistent line weight, vibrant colors that pop on dark backgrounds (#181b20).

Style: Kawaii-meets-tech aesthetic. Think Tamagotchi meets GitHub's Octocat meets Slack's custom emoji bots. Cute enough to smile at, professional enough for a developer tool.

Output: 8 separate 128×128px transparent PNGs
```

### CHAR-2. 에이전트 감정 표현 세트 (6종 × 64×64 PNG, 투명)

```
6 emotion variants of the GENERIC base robot character (no accessories), showing different states during task execution.

All use the same base robot body — ONLY the face expression and small visual cues change:

EMOTION 1 — IDLE "대기 중" (Teal #2fa184):
- Eyes: Normal, calm, slightly half-closed (relaxed)
- Mouth: Small gentle smile
- Extra: Small "..." speech bubble above head
- Antenna tip: Dim glow

EMOTION 2 — THINKING "생각 중" (Blue #4a87e8):
- Eyes: Looking up and to the right (thinking pose)
- Mouth: Small "o" shape
- Extra: Small lightbulb or "?" above head, tiny spinning gear
- Antenna tip: Pulsing glow

EMOTION 3 — WORKING "작업 중" (Teal #3dd9a8):
- Eyes: Focused, slight determination lines
- Mouth: Concentrated flat line with tiny tongue out to side
- Extra: Small sparkles/sweat drops near head, speed lines
- Antenna tip: Bright active glow

EMOTION 4 — HAPPY/DONE "완료!" (Green #2fa184):
- Eyes: Big, wide, star-shaped sparkles in eyes
- Mouth: Wide open smile (^_^)
- Extra: Small confetti/star burst around head, raised arms
- Antenna tip: Star-shaped glow

EMOTION 5 — ERROR "에러" (Red #d95c4f):
- Eyes: Spiral/dizzy eyes (X_X or @_@)
- Mouth: Wavy/distressed line
- Extra: Small error "!" in red speech bubble, tiny smoke wisps from antenna
- Antenna tip: Red warning glow

EMOTION 6 — BLOCKED/WAITING "대기" (Amber #d4a11e):
- Eyes: Droopy, patient, slightly sad
- Mouth: Small flat line (patient expression)
- Extra: Small clock icon above head, "zzz" bubble
- Antenna tip: Amber slow pulse

All: 64×64px, transparent background, consistent with CHAR-1 base design.
Style: Expressive enough to read at a glance, even at 32px display. Think Discord emoji or Slack reaction level of readability.

Output: 6 separate 64×64px transparent PNGs
```

### CHAR-3. 에이전트 팀 빌딩 시퀀스 (GIF, 320×200, 무한루프)

```
An animated sequence showing cute robots assembling into a team formation.

Animation (3 seconds total, looping):

Phase 1 — ARRIVAL (0-1s):
- 3-4 cute chibi robots drop in from above, one by one, with small bounce on landing
- Each has a different accessory (crown, glasses, magnifying glass, pencil)
- They land in a scattered arrangement

Phase 2 — CONNECT (1-2s):
- Robots turn to face each other
- Thin teal (#2fa184) connection lines draw between them
- The orchestrator (crown robot) in the center, others arrange around it
- Small sparkle effects at connection points

Phase 3 — READY (2-2.5s):
- All robots do a small "ready" pose (raise hand, nod, etc.)
- A soft teal glow surrounds the entire team
- Team formation is complete — arranged in a neat pattern

Phase 4 — RESET (2.5-3s):
- Gentle fade out, then loops back to Phase 1

Background: Transparent
Size: 320×200px
Framerate: 24fps

Color palette: Robots use their role accent colors (amber, blue, purple, teal) against transparent background. Connection lines in teal. Sparkles in light teal.

Style: Playful, satisfying "team forming" animation. Used on the Build Prompt screen during generation. Think Duolingo's lesson completion animation level of charm.

Output: Transparent GIF or Lottie JSON, 3-second loop
```

### CHAR-4. 에이전트 프로필 카드 배경 (4종 × 280×80 PNG)

```
4 gradient card backgrounds for agent profile cards, each with a subtle character silhouette watermark.

Card A — ORCHESTRATOR (Amber #e8a64a):
- Base: Dark elevated gray (#1f232a)
- Left edge: Subtle amber gradient fade (5% opacity, 40px wide)
- Watermark: Very faint (8% opacity) cute robot-with-crown silhouette in bottom-right corner
- Top-left accent: Tiny crown icon (12px)

Card B — CODER (Blue #4a87e8):
- Base: Dark elevated gray (#1f232a)
- Left edge: Subtle blue gradient fade (5% opacity, 40px wide)
- Watermark: Very faint (8% opacity) cute robot-with-glasses silhouette in bottom-right corner
- Top-left accent: Tiny code bracket icon (12px)

Card C — TESTER (Purple #a86ee5):
- Base: Dark elevated gray (#1f232a)
- Left edge: Subtle purple gradient fade (5% opacity, 40px wide)
- Watermark: Very faint (8% opacity) cute robot-with-magnifier silhouette in bottom-right corner
- Top-left accent: Tiny magnifying glass icon (12px)

Card D — GENERIC (Teal #2fa184):
- Base: Dark elevated gray (#1f232a)
- Left edge: Subtle teal gradient fade (5% opacity, 40px wide)
- Watermark: Very faint (8% opacity) cute base robot silhouette in bottom-right corner
- Top-left accent: Tiny robot head icon (12px)

All: 280×80px, 12px rounded corners, solid backgrounds (not transparent).
Style: Professional card with a tiny hint of personality from the watermark. The character is barely visible — a subtle easter egg.

Output: 4 separate 280×80px PNGs
```

---

## 프롬프트 사용 가이드

### 권장 AI 도구별 팁

| 도구 | 최적 사용처 | 설정 |
|------|------------|------|
| **Midjourney** | LOGO, ILLUST 카테고리 | `--style raw --no text --ar 1:1` (로고), `--ar 16:10` (일러스트) |
| **DALL-E 3** | LOGO, ILLUST, BG 카테고리 | "I NEED this exactly" prefix for precision |
| **Stable Diffusion (SDXL)** | BG, 텍스처 카테고리 | ControlNet tile model for seamless patterns |
| **Rive / Lottie Editor** | EFFECT, MICRO 카테고리 | JSON export for web embedding |
| **LottieFiles AI** | EFFECT 애니메이션 카테고리 | Direct Lottie JSON output |
| **SVGator** | EDGE, SCHED SVG 카테고리 | Animated SVG export |
| **Figma AI** | MICRO 아이콘 카테고리 | SVG vector output |

### 색상 일관성 체크리스트

모든 생성 결과물에 대해 확인:

- [ ] Primary teal이 #2fa184 또는 ±10% 범위 내인가?
- [ ] 배경 투명도가 올바른가? (PNG는 투명, BG는 불투명)
- [ ] 다크 테마 (#181b20 배경) 위에 올렸을 때 가시성 확보되는가?
- [ ] 28px 이하 축소 시에도 식별 가능한가? (아이콘 류)
- [ ] Seamless tile인 경우 실제 타일링 테스트했는가?

### 파일 네이밍 컨벤션

```
agentcanvas_{category}_{name}_{variant}.{ext}

예시:
agentcanvas_logo_main.png
agentcanvas_logo_sidebar_2x.png
agentcanvas_effect_task_running.gif
agentcanvas_effect_task_done.gif
agentcanvas_illust_empty_canvas.png
agentcanvas_bg_dot_grid_40.png
agentcanvas_micro_ripple_sprite.png
agentcanvas_edge_contains.svg
agentcanvas_sched_agent_badge_primary.png
agentcanvas_modal_command_glow.png
```

### 저장 경로

```
webview-ui/src/assets/
├── logo/           → LOGO-1~7
├── effects/        → EFFECT-1~10
├── illustrations/  → ILLUST-1~5
├── backgrounds/    → BG-1~4
├── micro/          → MICRO-1~6
├── edges/          → EDGE-1~5
├── schedule/       → SCHED-1~4
└── modal/          → MODAL-2~3
```

---

## 전체 에셋 목록 & 파일 형식 명세

### 정적 이미지 (PNG)

| ID | 에셋명 | 크기 | 파일명 | 배경 |
|----|--------|------|--------|------|
| LOGO-1 | 메인 로고 | 512×512 | `agentcanvas_logo_main.png` | 투명 |
| LOGO-2 | 사이드바 아이콘 | 56×56 | `agentcanvas_logo_sidebar_2x.png` | 투명 |
| LOGO-3 | 마켓플레이스 아이콘 | 128×128 | `agentcanvas_marketplace.png` | #181b20 |
| LOGO-4 | 빈 캔버스 일러스트 | 640×400 | `agentcanvas_empty_state.png` | 투명 |
| LOGO-6 | 파비콘 | 32×32 | `agentcanvas_favicon.png` | 투명 |
| EFFECT-9 | 드래그 고스트 | 280×80 | `agentcanvas_effect_drag_ghost.png` | 투명 |
| EFFECT-10 | 칸반 완료 스탬프 | 48×48 | `agentcanvas_effect_done_badge.png` | 투명 |
| ILLUST-1 | 팀 없음 초기 화면 | 800×500 | `agentcanvas_illust_no_team.png` | 투명 |
| ILLUST-2 | 실행 기록 없음 | 400×300 | `agentcanvas_illust_no_history.png` | 투명 |
| ILLUST-3 | 스킬 없음 | 400×300 | `agentcanvas_illust_no_skills.png` | 투명 |
| ILLUST-4 | 칸반 비어있음 | 600×400 | `agentcanvas_illust_no_tasks.png` | 투명 |
| ILLUST-5 | 연결 에러 | 320×240 | `agentcanvas_illust_connection_error.png` | 투명 |
| BG-1 | 도트 그리드 | 40×40 (tile) | `agentcanvas_bg_dot_grid.png` | 투명 |
| BG-2 | 빌드 프롬프트 배경 | 1200×800 | `agentcanvas_bg_build_prompt.png` | #181b20 |
| BG-3 | 노이즈 텍스처 | 200×200 (tile) | `agentcanvas_bg_noise.png` | 투명 |
| BG-4 | 에이전트 카드 배경 | 280×160 | `agentcanvas_bg_agent_card.png` | #1f232a |
| MICRO-2a | 토스트 INFO 아이콘 | 24×24 | `agentcanvas_micro_toast_info.png` | 투명 |
| MICRO-2b | 토스트 WARNING 아이콘 | 24×24 | `agentcanvas_micro_toast_warn.png` | 투명 |
| MICRO-2c | 토스트 ERROR 아이콘 | 24×24 | `agentcanvas_micro_toast_error.png` | 투명 |
| MICRO-5 | 오케스트레이터 크라운 | 20×20 | `agentcanvas_micro_crown.png` | 투명 |
| MICRO-6a | 컨텍스트 게이지 OK | 48×48 | `agentcanvas_micro_gauge_ok.png` | 투명 |
| MICRO-6b | 컨텍스트 게이지 WARN | 48×48 | `agentcanvas_micro_gauge_warn.png` | 투명 |
| MICRO-6c | 컨텍스트 게이지 DANGER | 48×48 | `agentcanvas_micro_gauge_danger.png` | 투명 |
| SCHED-1 | 타임라인 줄무늬 | 120×40 (tile) | `agentcanvas_sched_lane_bg.png` | 투명 |
| SCHED-2 | 시간 그리드 | 60×40 (tile) | `agentcanvas_sched_time_grid.png` | 투명 |
| SCHED-3a | 스윔레인 뱃지 Primary | 32×32 | `agentcanvas_sched_badge_primary.png` | 투명 |
| SCHED-3b | 스윔레인 뱃지 Orchestrator | 32×32 | `agentcanvas_sched_badge_orchestrator.png` | 투명 |
| SCHED-3c | 스윔레인 뱃지 Worker | 32×32 | `agentcanvas_sched_badge_worker.png` | 투명 |
| SCHED-3d | 스윔레인 뱃지 QA | 32×32 | `agentcanvas_sched_badge_qa.png` | 투명 |
| SCHED-4a | 태스크 블록 Default | 200×32 | `agentcanvas_sched_task_default.png` | 투명 |
| SCHED-4b | 태스크 블록 Running | 200×32 | `agentcanvas_sched_task_running.png` | 투명 |
| SCHED-4c | 태스크 블록 Done | 200×32 | `agentcanvas_sched_task_done.png` | 투명 |
| SCHED-4d | 태스크 블록 Failed | 200×32 | `agentcanvas_sched_task_failed.png` | 투명 |
| MODAL-2 | 커맨드 바 글로우 | 600×56 | `agentcanvas_modal_cmd_glow.png` | 투명 |
| CHAR-1a | 에이전트 Orchestrator | 128×128 | `agentcanvas_char_orchestrator.png` | 투명 |
| CHAR-1b | 에이전트 Coder | 128×128 | `agentcanvas_char_coder.png` | 투명 |
| CHAR-1c | 에이전트 Tester | 128×128 | `agentcanvas_char_tester.png` | 투명 |
| CHAR-1d | 에이전트 Writer | 128×128 | `agentcanvas_char_writer.png` | 투명 |
| CHAR-1e | 에이전트 Designer | 128×128 | `agentcanvas_char_designer.png` | 투명 |
| CHAR-1f | 에이전트 DevOps | 128×128 | `agentcanvas_char_devops.png` | 투명 |
| CHAR-1g | 에이전트 Data | 128×128 | `agentcanvas_char_data.png` | 투명 |
| CHAR-1h | 에이전트 Generic | 128×128 | `agentcanvas_char_generic.png` | 투명 |
| CHAR-2a | 감정 Idle | 64×64 | `agentcanvas_char_emotion_idle.png` | 투명 |
| CHAR-2b | 감정 Thinking | 64×64 | `agentcanvas_char_emotion_thinking.png` | 투명 |
| CHAR-2c | 감정 Working | 64×64 | `agentcanvas_char_emotion_working.png` | 투명 |
| CHAR-2d | 감정 Happy/Done | 64×64 | `agentcanvas_char_emotion_happy.png` | 투명 |
| CHAR-2e | 감정 Error | 64×64 | `agentcanvas_char_emotion_error.png` | 투명 |
| CHAR-2f | 감정 Blocked | 64×64 | `agentcanvas_char_emotion_blocked.png` | 투명 |
| CHAR-4a | 프로필카드 Orchestrator | 280×80 | `agentcanvas_char_card_orchestrator.png` | #1f232a |
| CHAR-4b | 프로필카드 Coder | 280×80 | `agentcanvas_char_card_coder.png` | #1f232a |
| CHAR-4c | 프로필카드 Tester | 280×80 | `agentcanvas_char_card_tester.png` | #1f232a |
| CHAR-4d | 프로필카드 Generic | 280×80 | `agentcanvas_char_card_generic.png` | #1f232a |

### SVG (벡터)

| ID | 에셋명 | 크기 | 파일명 |
|----|--------|------|--------|
| LOGO-5 | 로딩 SVG | 120×120 viewBox | `agentcanvas_loading.svg` |
| LOGO-7a | 아이콘 Skill | 64×64 viewBox | `icon_skill.svg` |
| LOGO-7b | 아이콘 Rule | 64×64 viewBox | `icon_rule.svg` |
| LOGO-7c | 아이콘 Agent | 64×64 viewBox | `icon_agent.svg` |
| LOGO-7d | 아이콘 Provider | 64×64 viewBox | `icon_provider.svg` |
| LOGO-7e | 아이콘 Folder | 64×64 viewBox | `icon_folder.svg` |
| LOGO-7f | 아이콘 Note | 64×64 viewBox | `icon_note.svg` |
| MICRO-3 | 드래그 핸들 | 12×20 viewBox | `agentcanvas_micro_drag_handle.svg` |
| MICRO-4a | 핀 Pinned | 16×16 viewBox | `agentcanvas_micro_pin_on.svg` |
| MICRO-4b | 핀 Unpinned | 16×16 viewBox | `agentcanvas_micro_pin_off.svg` |
| EDGE-1a~g | 엣지 패턴 7종 | 200×4 viewBox | `agentcanvas_edge_{type}.svg` |
| EDGE-3a~d | 방향 화살표 4종 | 12×12 viewBox | `agentcanvas_edge_arrow_{type}.svg` |
| MODAL-3 | 위저드 단계 인디케이터 | 400×40 viewBox | `agentcanvas_modal_wizard_steps.svg` |

### 애니메이션 (GIF / Lottie JSON)

| ID | 에셋명 | 크기 | 재생 | 파일명 | 권장 포맷 |
|----|--------|------|------|--------|----------|
| EFFECT-1 | Task Running 펄스 | 120×120 | 무한루프 | `agentcanvas_effect_task_running.gif` | Lottie 우선 |
| EFFECT-2 | Task 완료 체크 | 80×80 | 1회 | `agentcanvas_effect_task_done.gif` | Lottie 우선 |
| EFFECT-3 | Task 실패 X | 80×80 | 1회 | `agentcanvas_effect_task_failed.gif` | Lottie 우선 |
| EFFECT-4 | Blocked 경고 | 80×80 | 무한루프 | `agentcanvas_effect_task_blocked.gif` | Lottie 우선 |
| EFFECT-5 | 프로그레스 shimmer | 400×8 | 무한루프 | `agentcanvas_effect_progress_shimmer.gif` | CSS 대체 가능 |
| EFFECT-6 | Build Team 로더 | 200×200 | 무한루프 | `agentcanvas_effect_build_team.gif` | Lottie 우선 |
| EFFECT-8 | Now-Line 글로우 | 4×120 | 무한루프 | `agentcanvas_effect_now_line.gif` | CSS 대체 가능 |
| EDGE-4 | 의존성 흐름 파티클 | 32×32 | 무한루프 | `agentcanvas_edge_flow_particle.gif` | Lottie 우선 |
| CHAR-3 | 팀 빌딩 시퀀스 | 320×200 | 무한루프 | `agentcanvas_char_team_forming.gif` | Lottie 우선 |

### 스프라이트 시트 (PNG)

| ID | 에셋명 | 크기 | 프레임 | 파일명 |
|----|--------|------|--------|--------|
| EFFECT-7 | 데이터 흐름 파티클 | 256×32 | 8프레임 | `agentcanvas_effect_flow_sprite.png` |
| MICRO-1 | 버튼 리플 | 320×40 | 8프레임 | `agentcanvas_micro_ripple_sprite.png` |
| EDGE-2 | 엣지 선택 글로우 | 200×12 | 정적 | `agentcanvas_edge_select_glow.png` |
| EDGE-5 | 커넥션 프리뷰 라인 | 200×4 | 정적 | `agentcanvas_edge_preview_line.png` |

---

## 수량 요약

| 카테고리 | 정적 PNG | SVG | GIF/Lottie | Sprite | 소계 |
|----------|---------|-----|-----------|--------|------|
| 1. 로고 & 브랜딩 | 5 | 7 | 0 | 0 | **12** |
| 2. 상태 이펙트 | 2 | 0 | 6 | 1 | **9** |
| 3. Empty State 일러스트 | 5 | 0 | 0 | 0 | **5** |
| 4. 배경 & 텍스처 | 4 | 0 | 0 | 0 | **4** |
| 5. 마이크로 인터랙션 | 8 | 2 | 0 | 1 | **11** |
| 6. 엣지 & 커넥션 | 0 | 11 | 1 | 2 | **14** |
| 7. 스케줄 뷰 전용 | 10 | 0 | 0 | 0 | **10** |
| 8. 모달 & 오버레이 | 1 | 1 | 0 | 0 | **2** |
| 9. 에이전트 캐릭터 | 18 | 0 | 1 | 0 | **19** |
| **합계** | **53** | **21** | **8** | **4** | **86** |

**총 86개 파일 (PNG 53 + SVG 21 + GIF/Lottie 8 + Sprite 4)**

---

---

## 부록: SVG 코드 (바로 사용 가능)

> 아래 SVG 코드는 프로젝트에 바로 저장하여 사용할 수 있습니다.

### 0. 로고 SVG 세트 (LOGO-1~6)

**LOGO-1. 메인 로고 (512×512)** — 육각형 중앙 노드, 3개 방사형 연결선, 서브 노드, 그리드 도트

```xml
<svg viewBox="0 0 512 512" width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect x="64" y="64" width="384" height="384" rx="48" fill="none" stroke="#2fa184" stroke-width="16"/>
  <g fill="#2fa184" opacity="0.2">
    <circle cx="160" cy="160" r="4"/>
    <circle cx="352" cy="160" r="4"/>
    <circle cx="160" cy="352" r="4"/>
    <circle cx="352" cy="352" r="4"/>
  </g>
  <path d="M256 256 L160 160 M256 256 L384 210 M256 256 L256 384" stroke="#3dd9a8" stroke-width="12" stroke-linecap="round"/>
  <circle cx="160" cy="160" r="24" fill="none" stroke="#3dd9a8" stroke-width="12"/>
  <circle cx="384" cy="210" r="24" fill="none" stroke="#3dd9a8" stroke-width="12"/>
  <circle cx="256" cy="384" r="24" fill="none" stroke="#3dd9a8" stroke-width="12"/>
  <polygon points="256,208 296,232 296,280 256,304 216,280 216,232" fill="#2fa184"/>
  <circle cx="256" cy="256" r="12" fill="#181b20"/>
</svg>
```

**LOGO-2. 사이드바 콤팩트 아이콘 (56×56)** — 두꺼운 스트로크, 단순화된 형태

```xml
<svg viewBox="0 0 56 56" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="40" height="40" rx="10" fill="none" stroke="#2fa184" stroke-width="4"/>
  <path d="M28 28 L16 16 M28 28 L42 22 M28 28 L28 42" stroke="#2fa184" stroke-width="3" stroke-linecap="round"/>
  <circle cx="28" cy="28" r="5" fill="#2fa184"/>
</svg>
```

**LOGO-3. VS Code 마켓플레이스 아이콘 (128×128)** — 다크 네이비 배경, 축소 로고

```xml
<svg viewBox="0 0 128 128" width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="128" height="128" rx="16" fill="#181b20"/>
  <rect x="1" y="1" width="126" height="126" rx="15" fill="none" stroke="#1f232a" stroke-width="2"/>
  <g transform="translate(24, 24) scale(0.15625)">
    <rect x="64" y="64" width="384" height="384" rx="48" fill="none" stroke="#2fa184" stroke-width="24"/>
    <path d="M256 256 L160 160 M256 256 L384 210 M256 256 L256 384" stroke="#3dd9a8" stroke-width="16" stroke-linecap="round"/>
    <circle cx="160" cy="160" r="32" fill="#181b20" stroke="#3dd9a8" stroke-width="16"/>
    <circle cx="384" cy="210" r="32" fill="#181b20" stroke="#3dd9a8" stroke-width="16"/>
    <circle cx="256" cy="384" r="32" fill="#181b20" stroke="#3dd9a8" stroke-width="16"/>
    <polygon points="256,192 312,224 312,288 256,320 200,288 200,224" fill="#2fa184"/>
  </g>
</svg>
```

**LOGO-4. 빈 캔버스 일러스트 (640×400)** — 도트 그리드, 고스트 노드, 점선, + 마크

```xml
<svg viewBox="0 0 640 400" width="640" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dotGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.5" fill="#d7dce5" opacity="0.08"/>
    </pattern>
  </defs>
  <rect width="640" height="400" fill="url(#dotGrid)"/>
  <path d="M200 200 C 280 200, 280 120, 360 120 M 200 200 C 280 200, 280 280, 360 280" fill="none" stroke="#3dd9a8" stroke-width="3" stroke-dasharray="8 8" opacity="0.2"/>
  <rect x="80" y="160" width="120" height="80" rx="12" fill="#2fa184" fill-opacity="0.05" stroke="#2fa184" stroke-width="2" stroke-dasharray="6 6" stroke-opacity="0.15"/>
  <rect x="360" y="80" width="120" height="80" rx="12" fill="#2fa184" fill-opacity="0.05" stroke="#2fa184" stroke-width="2" stroke-dasharray="6 6" stroke-opacity="0.15"/>
  <rect x="360" y="240" width="120" height="80" rx="12" fill="#2fa184" fill-opacity="0.05" stroke="#2fa184" stroke-width="2" stroke-dasharray="6 6" stroke-opacity="0.15"/>
  <g transform="translate(280, 180)">
    <circle cx="24" cy="24" r="20" fill="#2fa184" fill-opacity="0.15"/>
    <path d="M24 14 L24 34 M14 24 L34 24" stroke="#2fa184" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
  </g>
</svg>
```

**LOGO-6. 파비콘 (32×32)** — 초간결 3개 도형

```xml
<svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="24" height="24" rx="6" fill="none" stroke="#2fa184" stroke-width="3"/>
  <circle cx="16" cy="16" r="3.5" fill="#2fa184"/>
  <path d="M16 16 L23 10 M16 16 L22 23" stroke="#2fa184" stroke-width="2" stroke-linecap="round"/>
</svg>
```

---

### 1. 로딩 & 애니메이션 SVG

**LOGO-5. 로딩/폴백 SVG (120×120)** — CSS 애니메이션(pulse, flow)이 포함되어 웹에서 바로 움직입니다.

```xml
<svg viewBox="0 0 120 120" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
  <style>
    .pulse { animation: pulse 2s ease-out infinite; transform-origin: center; }
    .flow { stroke-dasharray: 4; animation: flow 1s linear infinite; }
    @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes flow { to { stroke-dashoffset: -8; } }
  </style>
  <g class="pulse">
    <circle cx="60" cy="60" r="16" fill="none" stroke="#3dd9a8" stroke-width="2"/>
  </g>
  <rect x="48" y="48" width="24" height="24" rx="4" fill="#2fa184"/>
  <path class="flow" d="M60 36 L60 20 M84 60 L100 60 M60 84 L60 100" stroke="#2fa184" stroke-width="2"/>
  <circle cx="60" cy="20" r="4" fill="#2fa184"/>
  <circle cx="100" cy="60" r="4" fill="#2fa184"/>
  <circle cx="60" cy="100" r="4" fill="#2fa184"/>
</svg>
```

---

### 2. 노드 타입 아이콘 세트 (64×64)

**LOGO-7a. SKILL (번개)**

```xml
<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#2fa184" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="8" width="48" height="48" rx="12"/>
  <path d="M32 18 L20 36 h12 l-2 10 14-18 H32 l2-10 z"/>
</svg>
```

**LOGO-7b. RULE (문서 + 체크마크)**

```xml
<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#de9f30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M38 12v12h12" />
  <path d="M38 12L50 24v24a4 4 0 01-4 4H18a4 4 0 01-4-4V16a4 4 0 014-4h20z" />
  <path d="M24 34l6 6 12-12" />
</svg>
```

**LOGO-7c. AGENT (귀여운 봇 얼굴)**

```xml
<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#4a87e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="16" y="22" width="32" height="28" rx="8"/>
  <circle cx="24" cy="34" r="3" fill="#4a87e8" stroke="none"/>
  <circle cx="40" cy="34" r="3" fill="#4a87e8" stroke="none"/>
  <path d="M28 42q4 4 8 0" />
  <path d="M32 22v-6" />
  <circle cx="32" cy="14" r="2" />
</svg>
```

**LOGO-7d. PROVIDER (클라우드)**

```xml
<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#5875a4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 38a10 10 0 014-19 12 12 0 0122 4 8 8 0 01-4 15H22z"/>
  <path d="M32 38v10"/>
  <circle cx="32" cy="50" r="2" fill="#5875a4" stroke="none"/>
</svg>
```

**LOGO-7e. FOLDER (폴더)**

```xml
<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#6d7fd8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 20a4 4 0 014-4h12l4 4h16a4 4 0 014 4v24a4 4 0 01-4 4H16a4 4 0 01-4-4V20z"/>
</svg>
```

**LOGO-7f. NOTE (메모장)**

```xml
<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#b98516" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M48 38v-22a4 4 0 00-4-4H20a4 4 0 00-4 4v32a4 4 0 004 4h22l6-6z"/>
  <path d="M42 38h6v6"/>
  <path d="M24 24h16M24 32h16M24 40h8"/>
</svg>
```

---

### 3. 마이크로 인터랙션

**MICRO-3. 드래그 핸들 그립 (12×20)**

```xml
<svg viewBox="0 0 12 20" width="12" height="20" xmlns="http://www.w3.org/2000/svg">
  <g fill="#d7dce5" opacity="0.4">
    <circle cx="3" cy="4" r="1"/>
    <circle cx="9" cy="4" r="1"/>
    <circle cx="3" cy="10" r="1"/>
    <circle cx="9" cy="10" r="1"/>
    <circle cx="3" cy="16" r="1"/>
    <circle cx="9" cy="16" r="1"/>
  </g>
</svg>
```

**MICRO-4a. 핀 고정 - PINNED (16×16)**

```xml
<svg viewBox="0 0 16 16" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(15 8 8)" fill="#2fa184" stroke="#2fa184" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 3h6" />
    <path d="M6 3v4l-2 3v1h8v-1l-2-3V3" />
    <path d="M8 11v4" />
  </g>
</svg>
```

**MICRO-4b. 핀 해제 - UNPINNED (16×16)**

```xml
<svg viewBox="0 0 16 16" width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#d7dce5" stroke-opacity="0.4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <g transform="rotate(30 8 8)">
    <path d="M5 3h6" />
    <path d="M6 3v4l-2 3v1h8v-1l-2-3V3" />
    <path d="M8 11v4" />
  </g>
</svg>
```

**MICRO-2a. 토스트 아이콘 - INFO (24×24)**

```xml
<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#2fa184" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="16" x2="12" y2="12"/>
  <circle cx="12" cy="8" r="0.5" fill="#2fa184"/>
</svg>
```

**MICRO-2b. 토스트 아이콘 - WARNING (24×24)**

```xml
<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#d4a11e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10.3 3.2 L1.5 18.4 a2 2 0 0 0 1.7 3 h17.6 a2 2 0 0 0 1.7-3 L13.7 3.2 a2 2 0 0 0-3.4 0z"/>
  <line x1="12" y1="9" x2="12" y2="13"/>
  <circle cx="12" cy="16.5" r="0.5" fill="#d4a11e"/>
</svg>
```

**MICRO-2c. 토스트 아이콘 - ERROR (24×24)**

```xml
<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#d95c4f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <line x1="15" y1="9" x2="9" y2="15"/>
  <line x1="9" y1="9" x2="15" y2="15"/>
</svg>
```

---

### 4. 모달 & 오버레이

**MODAL-3. 스킬 위저드 단계 인디케이터 (400×40)** — glow 필터 포함

```xml
<svg viewBox="0 0 400 40" width="400" height="40" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <!-- 연결 라인 -->
  <line x1="58" y1="20" x2="140" y2="20" stroke="#2fa184" stroke-width="2"/>
  <line x1="160" y1="20" x2="200" y2="20" stroke="#2fa184" stroke-width="2"/>
  <line x1="200" y1="20" x2="242" y2="20" stroke="#d7dce5" stroke-opacity="0.3" stroke-width="2"/>
  <line x1="258" y1="20" x2="342" y2="20" stroke="#d7dce5" stroke-opacity="0.3" stroke-width="2"/>

  <!-- Step 1 (완료) -->
  <circle cx="50" cy="20" r="8" fill="#2fa184"/>
  <path d="M46 20l3 3 5-5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Step 2 (현재 진행 중) -->
  <circle cx="150" cy="20" r="9" fill="#2fa184" filter="url(#glow)"/>
  <circle cx="150" cy="20" r="4" fill="#181b20"/>

  <!-- Step 3 (예정) -->
  <circle cx="250" cy="20" r="7" fill="#181b20" stroke="#d7dce5" stroke-opacity="0.3" stroke-width="2"/>

  <!-- Step 4 (예정) -->
  <circle cx="350" cy="20" r="7" fill="#181b20" stroke="#d7dce5" stroke-opacity="0.3" stroke-width="2"/>
</svg>
```

---

### 5. 엣지 라인 패턴 세트 (200×4)

CSS 배경으로 반복시켜 사용하기 좋은 라인입니다.

**EDGE-1a. CONTAINS (실선)**

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="200" y2="2" stroke="#2fa184" stroke-width="2"/></svg>
```

**EDGE-1b. OVERRIDES (대시선)**

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="200" y2="2" stroke="#de9f30" stroke-width="2" stroke-dasharray="8 4"/></svg>
```

**EDGE-1c. LOCATED_IN (점선)**

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="200" y2="2" stroke="#6d7fd8" stroke-width="2" stroke-linecap="round" stroke-dasharray="0 6"/></svg>
```

**EDGE-1d. APPLIES_TO (얇은 실선)**

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="200" y2="2" stroke="#4a87e8" stroke-width="1.5"/></svg>
```

**EDGE-1e. AGENT_LINK (화살표 실선)**

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg">
  <line x1="0" y1="2" x2="196" y2="2" stroke="#4a87e8" stroke-width="2"/>
  <polygon points="194,0 200,2 194,4" fill="#4a87e8"/>
</svg>
```

**EDGE-1f. DELEGATES (대시-점-대시 혼합선)**

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="200" y2="2" stroke="#e8a64a" stroke-width="2" stroke-dasharray="12 4 2 4"/></svg>
```

**EDGE-1g. INTERACTION (중앙 마름모 실선)**

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg">
  <line x1="0" y1="2" x2="200" y2="2" stroke="#a86ee5" stroke-width="1.5"/>
  <polygon points="100,0 103,2 100,4 97,2" fill="#a86ee5"/>
</svg>
```

---

### 6. 방향 화살표 마커 (12×12)

**EDGE-3a. Standard (채운 삼각형)**

```xml
<svg viewBox="0 0 12 12" width="12" height="12" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 2 L10 6 L2 10 Z" fill="#2fa184"/>
</svg>
```

**EDGE-3b. Diamond (마름모)**

```xml
<svg viewBox="0 0 12 12" width="12" height="12" xmlns="http://www.w3.org/2000/svg">
  <polygon points="6,2 10,6 6,10 2,6" fill="#de9f30"/>
</svg>
```

**EDGE-3c. Circle (원형)**

```xml
<svg viewBox="0 0 12 12" width="12" height="12" xmlns="http://www.w3.org/2000/svg">
  <circle cx="6" cy="6" r="4" fill="#4a87e8"/>
</svg>
```

**EDGE-3d. Open (열린 삼각형)**

```xml
<svg viewBox="0 0 12 12" width="12" height="12" xmlns="http://www.w3.org/2000/svg">
  <polygon points="2,2 10,6 2,10" fill="none" stroke="#a86ee5" stroke-width="2" stroke-linejoin="round"/>
</svg>
```

---

### 7. 상태 이펙트 SVG (카테고리 2)

**EFFECT-1. Task Running 펄스 (120×120)** — 무한루프, 2중 링 확장 애니메이션

```xml
<svg viewBox="0 0 120 120" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
  <style>
    .ring { fill: none; stroke: #2fa184; stroke-width: 2; transform-origin: 60px 60px; animation: pulse 1.5s infinite linear; }
    .r2 { animation-delay: 0.75s; }
    @keyframes pulse { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(1); opacity: 0; } }
  </style>
  <circle cx="60" cy="60" r="58" class="ring"/>
  <circle cx="60" cy="60" r="58" class="ring r2"/>
</svg>
```

**EFFECT-2. Task 완료 체크마크 (80×80)** — 1회 재생, 원→체크→글로우 시퀀스

```xml
<svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
  <style>
    .circle { fill: none; stroke: #2fa184; stroke-width: 3; stroke-dasharray: 200; stroke-dashoffset: 200; animation: drawC 0.2s forwards; }
    .check { fill: none; stroke: #3dd9a8; stroke-width: 3; stroke-dasharray: 50; stroke-dashoffset: 50; stroke-linecap: round; stroke-linejoin: round; animation: drawK 0.25s 0.2s forwards; }
    .glow { fill: #3dd9a8; opacity: 0; animation: flash 0.15s 0.45s forwards; }
    @keyframes drawC { to { stroke-dashoffset: 0; } }
    @keyframes drawK { to { stroke-dashoffset: 0; } }
    @keyframes flash { 0%, 100% { opacity: 0; } 50% { opacity: 0.2; } }
  </style>
  <circle cx="40" cy="40" r="30" class="glow"/>
  <circle cx="40" cy="40" r="30" class="circle" transform="rotate(-90 40 40)"/>
  <path d="M28 40 l8 8 l16 -16" class="check"/>
</svg>
```

**EFFECT-3. Task 실패 X마크 (80×80)** — 1회 재생, 원→X→쉐이크 시퀀스

```xml
<svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
  <style>
    .wrap { transform-origin: 40px 40px; animation: shake 0.15s 0.35s forwards; }
    .circle { fill: none; stroke: #d95c4f; stroke-width: 3; stroke-dasharray: 200; stroke-dashoffset: 200; animation: drawC 0.15s forwards; }
    .x { fill: none; stroke: #d95c4f; stroke-width: 3; stroke-dasharray: 40; stroke-dashoffset: 40; stroke-linecap: round; animation: drawX 0.2s 0.15s forwards; }
    @keyframes drawC { to { stroke-dashoffset: 0; } }
    @keyframes drawX { to { stroke-dashoffset: 0; } }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
  </style>
  <g class="wrap">
    <circle cx="40" cy="40" r="30" class="circle" transform="rotate(-90 40 40)"/>
    <path d="M28 28 l24 24 m0 -24 l-24 24" class="x"/>
  </g>
</svg>
```

**EFFECT-4. Task Blocked 경고 (80×80)** — 무한루프, 부드러운 펄스

```xml
<svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
  <style>
    .warn { animation: pWarn 2s infinite ease-in-out; transform-origin: 40px 44px; }
    @keyframes pWarn { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } }
  </style>
  <g class="warn">
    <polygon points="40,16 64,60 16,60" fill="none" stroke="#d4a11e" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 32 v14 m0 6 v2" stroke="#d4a11e" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>
```

**EFFECT-5. 프로그레스 바 shimmer (400×8)** — 무한루프, 빛 반사 스위프

```xml
<svg viewBox="0 0 400 8" width="400" height="8" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="bar"><rect width="400" height="8" rx="4"/></clipPath>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3dd9a8" stop-opacity="0"/>
      <stop offset="50%" stop-color="#3dd9a8" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#3dd9a8" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <style>
    .sweep { animation: moveRight 1.5s infinite linear; }
    @keyframes moveRight { 0% { transform: translateX(-100px) skewX(-30deg); } 100% { transform: translateX(400px) skewX(-30deg); } }
  </style>
  <rect width="400" height="8" fill="#2fa184" rx="4"/>
  <g clip-path="url(#bar)">
    <rect x="0" y="0" width="80" height="8" fill="url(#glow)" class="sweep"/>
  </g>
</svg>
```

**EFFECT-6. Build Team 생성 로더 (200×200)** — 무한루프, 3봇 순차 활성화

```xml
<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <style>
    .bot { opacity: 0.3; transition: opacity 0.2s; }
    .line { stroke: #2fa184; stroke-width: 1; stroke-dasharray: 100; stroke-dashoffset: 100; }
    @keyframes wake { 0%, 100% { opacity: 0.3; } 10%, 90% { opacity: 1; } }
    @keyframes connect { 0%, 100% { stroke-dashoffset: 100; } 20%, 90% { stroke-dashoffset: 0; } }
    .b1 { animation: wake 2s infinite 0s; } .l1 { animation: connect 2s infinite 0.5s; }
    .b2 { animation: wake 2s infinite 0.5s; } .l2 { animation: connect 2s infinite 1.0s; }
    .b3 { animation: wake 2s infinite 1.0s; } .l3 { animation: connect 2s infinite 1.5s; }
  </style>
  <line x1="100" y1="60" x2="60" y2="130" class="line l1"/>
  <line x1="60" y1="130" x2="140" y2="130" class="line l2"/>
  <line x1="140" y1="130" x2="100" y2="60" class="line l3"/>
  <g transform="translate(100, 50)" stroke="#e8a64a" stroke-width="2" class="bot b1">
    <rect x="-16" y="-14" width="32" height="28" rx="6" fill="#181b20"/><path d="M-6 -20 l6 -6 l6 6" fill="none"/><circle cx="-6" cy="-2" r="3" fill="#3dd9a8"/><circle cx="6" cy="-2" r="3" fill="#3dd9a8"/>
  </g>
  <g transform="translate(50, 140)" stroke="#4a87e8" stroke-width="2" class="bot b2">
    <rect x="-16" y="-14" width="32" height="28" rx="6" fill="#181b20"/><circle cx="-6" cy="-2" r="3" fill="#3dd9a8"/><circle cx="6" cy="-2" r="3" fill="#3dd9a8"/><path d="M-22 0 l-6 -6 m0 12 l6 -6" fill="none"/>
  </g>
  <g transform="translate(150, 140)" stroke="#2fa184" stroke-width="2" class="bot b3">
    <rect x="-16" y="-14" width="32" height="28" rx="6" fill="#181b20"/><circle cx="-6" cy="-2" r="3" fill="#3dd9a8"/><circle cx="6" cy="-2" r="3" fill="#3dd9a8"/><circle cx="20" cy="0" r="4" fill="none"/>
  </g>
</svg>
```

**EFFECT-7. 노드 연결 데이터 흐름 (256×32)** — 무한루프, 파티클 + 트레일

```xml
<svg viewBox="0 0 256 32" width="256" height="32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3dd9a8" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3dd9a8" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <style>
    .particle { animation: flowMove 1.5s linear infinite; }
    @keyframes flowMove { 0% { transform: translateX(-40px); } 100% { transform: translateX(260px); } }
  </style>
  <g class="particle">
    <rect x="-30" y="14" width="30" height="4" fill="url(#trail)" rx="2"/>
    <circle cx="0" cy="16" r="3" fill="#3dd9a8"/>
  </g>
</svg>
```

**EFFECT-8. Schedule Now-Line 글로우 (4×120)** — 무한루프, 수직선 펄스

```xml
<svg viewBox="0 0 4 120" width="4" height="120" xmlns="http://www.w3.org/2000/svg">
  <style>
    .halo { animation: pulseGlow 2s infinite ease-in-out; }
    @keyframes pulseGlow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
  </style>
  <rect x="0" y="0" width="4" height="120" fill="#3dd9a8" class="halo"/>
  <rect x="1" y="0" width="2" height="120" fill="#2fa184"/>
</svg>
```

**EFFECT-9. Drag & Drop 고스트 오버레이 (280×80)** — 정적, 드롭섀도우

```xml
<svg viewBox="0 0 280 80" width="280" height="80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.3"/></filter>
  </defs>
  <rect x="2" y="2" width="276" height="76" rx="8" fill="#1f232a" fill-opacity="0.7" stroke="#2fa184" stroke-width="1.5" stroke-dasharray="6 6" stroke-opacity="0.5" filter="url(#shadow)"/>
  <line x1="20" y1="30" x2="200" y2="30" stroke="#d7dce5" stroke-opacity="0.2" stroke-width="4" stroke-linecap="round"/>
  <line x1="20" y1="50" x2="140" y2="50" stroke="#d7dce5" stroke-opacity="0.2" stroke-width="4" stroke-linecap="round"/>
</svg>
```

**EFFECT-10. 칸반 카드 완료 스탬프 (48×48)** — 정적, 틸 배지 + 체크

```xml
<svg viewBox="0 0 48 48" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="24" r="23" fill="#2fa184" stroke="#3dd9a8" stroke-width="1"/>
  <path d="M14 24 l6 6 l14 -14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

---

### 8. Empty State 일러스트 SVG (카테고리 3)

**ILLUST-1. "팀 없음" 초기 화면 (800×500)** — 프롬프트 고스트, 대기 봇 2마리

```xml
<svg viewBox="0 0 800 500" width="800" height="500" xmlns="http://www.w3.org/2000/svg">
  <rect x="250" y="200" width="300" height="60" rx="30" fill="none" stroke="#2fa184" stroke-width="2" stroke-opacity="0.4" stroke-dasharray="8 8"/>
  <text x="400" y="235" fill="#2fa184" opacity="0.4" font-family="sans-serif" font-size="16" text-anchor="middle">Start building your team...</text>
  <path d="M 200 300 Q 400 450 600 300" fill="none" stroke="#2fa184" stroke-width="2" stroke-opacity="0.2" stroke-dasharray="6 6"/>
  <g transform="translate(160, 260)" stroke="#4a87e8" stroke-width="2" fill="none" opacity="0.5">
    <rect x="0" y="0" width="60" height="50" rx="12"/><circle cx="20" cy="20" r="4" fill="#4a87e8"/><circle cx="40" cy="20" r="4" fill="#4a87e8"/><path d="M 25 35 Q 30 40 35 35"/>
    <text x="-10" y="-10" stroke="none" fill="#4a87e8" font-size="12">zzz</text>
  </g>
  <g transform="translate(580, 260)" stroke="#2fa184" stroke-width="2" fill="none" opacity="0.5">
    <rect x="0" y="0" width="60" height="50" rx="12"/><circle cx="20" cy="20" r="4" fill="#2fa184"/><circle cx="40" cy="20" r="4" fill="#2fa184"/><path d="M 25 35 Q 30 40 35 35"/>
    <path d="M 60 25 Q 75 10 70 30" stroke-linecap="round"/>
  </g>
</svg>
```

**ILLUST-2. "실행 기록 없음" (400×300)** — 페이드 라인 + 시계 아이콘

```xml
<svg viewBox="0 0 400 300" width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <line x1="80" y1="100" x2="320" y2="100" stroke="#d7dce5" stroke-opacity="0.1" stroke-width="8" stroke-linecap="round"/>
  <line x1="80" y1="150" x2="280" y2="150" stroke="#d7dce5" stroke-opacity="0.1" stroke-width="8" stroke-linecap="round"/>
  <line x1="80" y1="200" x2="240" y2="200" stroke="#d7dce5" stroke-opacity="0.1" stroke-width="8" stroke-linecap="round"/>
  <g transform="translate(200, 150)" stroke="#2fa184" stroke-width="3" fill="none" opacity="0.2">
    <circle cx="0" cy="0" r="30"/>
    <path d="M0 -15 L0 0 L10 10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
```

**ILLUST-3. "스킬 없음" (400×300)** — 카드 + 점선 플레이스홀더 + "+" 아이콘

```xml
<svg viewBox="0 0 400 300" width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="40" width="200" height="220" rx="16" fill="none" stroke="#4a87e8" stroke-opacity="0.15" stroke-width="3"/>
  <rect x="120" y="80" width="160" height="36" rx="8" fill="none" stroke="#d7dce5" stroke-opacity="0.1" stroke-width="2" stroke-dasharray="4 4"/>
  <rect x="120" y="130" width="160" height="36" rx="8" fill="none" stroke="#d7dce5" stroke-opacity="0.1" stroke-width="2" stroke-dasharray="4 4"/>
  <rect x="120" y="180" width="160" height="36" rx="8" fill="none" stroke="#d7dce5" stroke-opacity="0.1" stroke-width="2" stroke-dasharray="4 4"/>
  <path d="M 270 70 L 270 90 M 260 80 L 280 80" stroke="#2fa184" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
</svg>
```

**ILLUST-4. "칸반 보드 비어있음" (600×400)** — 3컬럼 점선 + 고스트 카드

```xml
<svg viewBox="0 0 600 400" width="600" height="400" xmlns="http://www.w3.org/2000/svg">
  <rect x="60" y="60" width="140" height="300" rx="12" fill="none" stroke="#d7dce5" stroke-opacity="0.12" stroke-width="2" stroke-dasharray="6 6"/>
  <rect x="230" y="60" width="140" height="300" rx="12" fill="none" stroke="#d7dce5" stroke-opacity="0.12" stroke-width="2" stroke-dasharray="6 6"/>
  <rect x="400" y="60" width="140" height="300" rx="12" fill="none" stroke="#d7dce5" stroke-opacity="0.12" stroke-width="2" stroke-dasharray="6 6"/>
  <rect x="80" y="80" width="100" height="12" rx="6" fill="#d7dce5" opacity="0.2"/>
  <rect x="250" y="80" width="100" height="12" rx="6" fill="#d7dce5" opacity="0.2"/>
  <rect x="420" y="80" width="100" height="12" rx="6" fill="#d7dce5" opacity="0.2"/>
  <rect x="70" y="40" width="120" height="60" rx="8" fill="#2fa184" fill-opacity="0.2"/>
  <path d="M 130 110 L 130 130 M 125 125 L 130 130 L 135 125" stroke="#2fa184" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.5"/>
</svg>
```

**ILLUST-5. "연결 에러" (320×240)** — 클라우드 + 끊어진 연결 X마크

```xml
<svg viewBox="0 0 320 240" width="320" height="240" xmlns="http://www.w3.org/2000/svg">
  <path d="M 120 100 A 30 30 0 0 1 150 70 A 40 40 0 0 1 210 100 A 30 30 0 0 1 210 160 L 120 160 A 30 30 0 0 1 120 100" fill="#d7dce5" opacity="0.25"/>
  <line x1="160" y1="220" x2="160" y2="180" stroke="#2fa184" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
  <path d="M 145 165 L 175 195 M 175 165 L 145 195" stroke="#d95c4f" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
</svg>
```

---

### 9. 배경 & 텍스처 SVG (카테고리 4)

**BG-1. 캔버스 도트 그리드 (40×40, Seamless Tile)**

```xml
<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="1.5" fill="#d7dce5" opacity="0.08"/>
</svg>
```

**BG-2. 빌드 프롬프트 화면 그라디언트 (1200×800)** — radial gradient + faint dot grid

```xml
<svg viewBox="0 0 1200 800" width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="promptBg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#2fa184" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#181b20" stop-opacity="1"/>
    </radialGradient>
    <pattern id="faintDot" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.5" fill="#d7dce5" opacity="0.03"/>
    </pattern>
  </defs>
  <rect width="1200" height="800" fill="#181b20"/>
  <rect width="1200" height="800" fill="url(#promptBg)"/>
  <rect width="1200" height="800" fill="url(#faintDot)"/>
</svg>
```

**BG-3. 헤더/상태바 노이즈 텍스처 (200×200, feTurbulence 필터)**

```xml
<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="1 0 0 0 0, 1 0 0 0 0, 1 0 0 0 0, 0 0 0 0.04 0" />
    </filter>
  </defs>
  <rect width="200" height="200" fill="transparent" filter="url(#noiseFilter)"/>
</svg>
```

**BG-4. 에이전트 카드 미묘한 그라디언트 (280×160)** — 위→아래 미세 그라디언트 + 상단 빛 반사

```xml
<svg viewBox="0 0 280 160" width="280" height="160" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1f232a"/>
      <stop offset="100%" stop-color="#181b20"/>
    </linearGradient>
  </defs>
  <rect width="280" height="160" rx="12" fill="url(#cardBg)"/>
  <rect x="1" y="1" width="278" height="158" rx="11" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.05"/>
</svg>
```

---

### 10. 스케줄 뷰 SVG (카테고리 7)

**SCHED-1. 타임라인 배경 줄무늬 (120×40)**

```xml
<svg viewBox="0 0 120 40" width="120" height="40" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="39" width="120" height="1" fill="#d7dce5" opacity="0.08"/>
</svg>
```

**SCHED-2. 시간 그리드 마커 (60×40)**

```xml
<svg viewBox="0 0 60 40" width="60" height="40" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="1" height="40" fill="#d7dce5" opacity="0.06"/>
</svg>
```

**SCHED-3a~d. 스윔레인 에이전트 뱃지 (32×32, 4종)** — Primary(Blue), Orchestrator(Amber+왕관), Worker(Teal), QA(Purple+안경) — 파일 참조: `assets/schedule/agentcanvas_sched_badge_*.svg`

**SCHED-4a~d. 태스크 블록 텍스처 (200×32, 4종)** — Default, Running(사선), Done, Failed(격자) — 파일 참조: `assets/schedule/agentcanvas_sched_task_*.svg`

---

### 11. 모달 & 마이크로 추가분 (카테고리 5, 8)

**MODAL-2. 커맨드 바 입력 글로우 (600×56)** — Gaussian blur 글로우 필터

```xml
<svg viewBox="0 0 600 56" width="600" height="56" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="4" y="4" width="592" height="48" rx="12" fill="none" stroke="#2fa184" stroke-width="1.5" filter="url(#glow)" stroke-opacity="0.3"/>
  <rect x="4" y="4" width="592" height="48" rx="12" fill="none" stroke="#2fa184" stroke-width="1.5"/>
  <rect x="16" y="4" width="568" height="1" fill="#3dd9a8" opacity="0.2"/>
</svg>
```

**MICRO-5. 오케스트레이터 크라운 뱃지 (20×20)**

```xml
<svg viewBox="0 0 20 20" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
  <polygon points="2,16 4,6 9,11 11,11 16,6 18,16" fill="none" stroke="#e8a64a" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="10" cy="9" r="1.5" fill="#e8a64a"/>
</svg>
```

**MICRO-6a~c. 컨텍스트 미터 게이지 (48×48, 3종)** — OK(75%/Teal), WARN(88%/Amber), DANGER(96%/Red) — 파일 참조: `assets/micro/agentcanvas_micro_gauge_*.svg`

---

### 12. 에이전트 캐릭터 SVG (카테고리 9)

**CHAR-1a~h. 캐릭터 기본 세트 (128×128, 8종)** — Orchestrator(왕관), Coder(안경+랩톱), Tester(돋보기), Writer(연필), Designer(베레모), DevOps(안전모), Data(동그란안경), Generic(손흔들기) — 파일 참조: `assets/characters/agentcanvas_char_*.svg`

**CHAR-2a~f. 감정 표현 세트 (64×64, 6종)** — Idle(반쯤감은눈), Thinking(?마크), Working(집중선), Happy(별눈), Error(X눈), Blocked(시계) — 파일 참조: `assets/characters/agentcanvas_char_emotion_*.svg`

**CHAR-3. 팀 빌딩 시퀀스 (320×200)** — CSS drop/draw/pulse 애니메이션, 3봇 삼각형 포메이션

```xml
<!-- 파일 참조: assets/characters/agentcanvas_char_team_forming.svg -->
<!-- 3초 루프: drop → connect → glow → fade -->
```

**CHAR-4a~d. 프로필 카드 배경 (280×80, 4종)** — 역할별 좌측 그라디언트 + 실루엣 워터마크 — 파일 참조: `assets/characters/agentcanvas_char_card_*.svg`

### 13. 미제작 4종 보완 (MICRO-1, EDGE-2, EDGE-4, EDGE-5)

**MICRO-1. 버튼 리플 이펙트 (40×40 SVG, CSS 애니메이션)** — 3겹 원형 리플이 0.15s 간격으로 확장·소멸

```xml
<svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
  <style>
    .ripple { fill: #2fa184; transform-origin: 20px 20px; animation: ripple-expand 0.6s ease-out forwards; opacity: 0; }
    .r1 { animation-delay: 0s; }
    .r2 { animation-delay: 0.15s; }
    .r3 { animation-delay: 0.3s; }
    @keyframes ripple-expand {
      0%   { transform: scale(0.1); opacity: 0.5; }
      40%  { opacity: 0.3; }
      100% { transform: scale(1); opacity: 0; }
    }
  </style>
  <circle cx="20" cy="20" r="20" class="ripple r1"/>
  <circle cx="20" cy="20" r="20" class="ripple r2"/>
  <circle cx="20" cy="20" r="20" class="ripple r3"/>
</svg>
```

**EDGE-2. 엣지 선택 하이라이트 글로우 (200×12 SVG)** — 3레이어 라인(외부 글로우 + 중간 + 코어) + feGaussianBlur 필터 + 펄스 애니메이션

```xml
<svg viewBox="0 0 200 12" width="200" height="12" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="edgeGlow" x="-10%" y="-50%" width="120%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
      <feColorMatrix in="blur" type="matrix"
        values="0 0 0 0 0.184
                0 0 0 0 0.631
                0 0 0 0 0.525
                0 0 0 0.6 0" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <style>
    .glow-line { animation: glow-pulse 1.8s ease-in-out infinite; }
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.7; }
      50%      { opacity: 1; }
    }
  </style>
  <line x1="0" y1="6" x2="200" y2="6" stroke="#3dd9a8" stroke-width="6" opacity="0.25" stroke-linecap="round" class="glow-line"/>
  <line x1="0" y1="6" x2="200" y2="6" stroke="#2fa184" stroke-width="3" opacity="0.5" stroke-linecap="round" class="glow-line"/>
  <line x1="0" y1="6" x2="200" y2="6" stroke="#2fa184" stroke-width="2" stroke-linecap="round" filter="url(#edgeGlow)"/>
</svg>
```

**EDGE-4. 의존성 흐름 파티클 (32×32 SVG)** — radialGradient 글로우 파티클 + linearGradient 코멧 트레일, 0.8s translateX 무한루프

```xml
<svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="particleGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3dd9a8" stop-opacity="1"/>
      <stop offset="50%" stop-color="#3dd9a8" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#2fa184" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="trail" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#2fa184" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2fa184" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <style>
    .particle-group { animation: flow-move 0.8s linear infinite; }
    @keyframes flow-move {
      0%   { transform: translateX(-32px); }
      100% { transform: translateX(32px); }
    }
  </style>
  <g class="particle-group">
    <rect x="2" y="14" width="14" height="4" rx="2" fill="url(#trail)"/>
    <circle cx="18" cy="16" r="3" fill="#3dd9a8"/>
    <circle cx="18" cy="16" r="6" fill="url(#particleGlow)" opacity="0.5"/>
  </g>
</svg>
```

**EDGE-5. 커넥션 생성 프리뷰 라인 (200×4 SVG)** — 8-6 대시 패턴 + dash-flow 애니메이션 + 끝점 연결 힌트 원

```xml
<svg viewBox="0 0 200 4" width="200" height="4" xmlns="http://www.w3.org/2000/svg">
  <style>
    .preview-dash { animation: dash-flow 1s linear infinite; }
    @keyframes dash-flow {
      0%   { stroke-dashoffset: 28; }
      100% { stroke-dashoffset: 0; }
    }
  </style>
  <line x1="0" y1="2" x2="192" y2="2"
    stroke="#d7dce5" stroke-opacity="0.5"
    stroke-width="2" stroke-linecap="round"
    stroke-dasharray="8 6"
    class="preview-dash"/>
  <circle cx="196" cy="2" r="2" fill="#d7dce5" fill-opacity="0.5"/>
</svg>
```

---

*이 문서의 모든 프롬프트는 AgentCanvas 디자인 시스템(UI.md §1.3 컬러 팔레트, §3 CSS 디자인 시스템)에 맞춰 작성되었습니다.*
