# AgentCanvas 브랜딩 & 로고 디자인 가이드

> 작성일: 2026-02-18
> 목적: 제품명 "AgentCanvas"로 통일, AI 이미지 생성용 로고 프롬프트 정리

---

## 1. 현재 브랜딩 문제점

코드 전체에서 **4가지 이름**이 혼용되고 있습니다:

| 현재 사용명 | 위치 | 변경 대상 |
|-----------|------|----------|
| `agent-studio` | package.json `name`, VS Code command prefix, zipPack manifest, launch.json, tasks.json | `agent-canvas` |
| `Agent Studio` | package.json commands 타이틀, mvp.md, instruction 문서들 | `AgentCanvas` |
| `Open Canvas` | package.json `displayName`, LeftSidebar 브랜드, index.html title, extension.ts 패널/에러 메시지, fallback HTML | `AgentCanvas` |
| `Nano Banana` | 로고 이미지 (`nano_banana_logo.png`), alt 텍스트 | 교체 필요 |

### 변경이 필요한 파일 전체 목록

| 파일 | 행 | 현재 값 | 변경 값 |
|-----|-----|--------|--------|
| `package.json` | 2 | `"name": "agent-studio"` | `"name": "agent-canvas"` |
| `package.json` | 3 | `"displayName": "Open Canvas"` | `"displayName": "AgentCanvas"` |
| `package.json` | 4 | description 내 "Agent Studio" | "AgentCanvas" |
| `package.json` | 14 | `"onCommand:agentStudio.open"` | `"onCommand:agentCanvas.open"` |
| `package.json` | 20 | `"command": "agentStudio.open"` | `"command": "agentCanvas.open"` |
| `package.json` | 21 | `"title": "Agent Studio: Open"` | `"title": "AgentCanvas: Open"` |
| `package.json` | 24 | `"command": "agentStudio.refresh"` | `"command": "agentCanvas.refresh"` |
| `package.json` | 25 | `"title": "Agent Studio: Refresh"` | `"title": "AgentCanvas: Refresh"` |
| `package.json` | 30~40 | `"agentStudio.*"` config keys | `"agentCanvas.*"` |
| `extension.ts` | 29 | `"agentStudio.open"` | `"agentCanvas.open"` |
| `extension.ts` | 35 | `"agentStudio.refresh"` | `"agentCanvas.refresh"` |
| `extension.ts` | 47 | `viewType = "agentStudio.panel"` | `"agentCanvas.panel"` |
| `extension.ts` | 76,81 | `"Open Canvas operation failed"` | `"AgentCanvas operation failed"` |
| `extension.ts` | 98 | `"Open Canvas"` (패널 타이틀) | `"AgentCanvas"` |
| `extension.ts` | 269,286 | `getConfiguration("agentStudio")` | `"agentCanvas"` |
| `extension.ts` | 338 | `<h2>Open Canvas</h2>` | `<h2>AgentCanvas</h2>` |
| `extension.ts` | 654 | `agentStudio.notes:` storage key | `agentCanvas.notes:` |
| `zipPack.ts` | 48 | `"agent-studio-pack"` | `"agent-canvas-pack"` |
| `index.html` | 6 | `<title>Open Canvas</title>` | `<title>AgentCanvas</title>` |
| `LeftSidebar.tsx` | 2 | `import logo from "../assets/nano_banana_logo.png"` | 새 로고 파일로 변경 |
| `LeftSidebar.tsx` | 23 | `alt="Open Canvas Logo"` | `alt="AgentCanvas Logo"` |
| `LeftSidebar.tsx` | 24 | `Open Canvas` | `AgentCanvas` |
| `.vscode/tasks.json` | 5 | `"agent-studio: build"` | `"agent-canvas: build"` |
| `.vscode/launch.json` | 5,15 | `"Run Agent Studio Extension"` 등 | `"AgentCanvas"` |
| `README.md` | 전체 | "Agent Studio" 언급 | "AgentCanvas" |

---

## 2. 디자인 컨셉

### 핵심 키워드

**"Agent + Canvas"** — AI 에이전트의 스킬과 규칙을 시각적으로 배치하고 관리하는 캔버스 도구

### 컨셉 방향

n8n, Retool 같은 노드 기반 비주얼 에디터의 느낌. 핵심 은유는 "노드와 연결선이 있는 캔버스 위에서 AI 에이전트를 설계하는 것". 기술적이면서도 깔끔하고 모던한 톤.

### 컬러 팔레트

현재 UI의 다크 테마 기반을 유지하면서 통일합니다:

| 용도 | 색상 | Hex |
|------|------|-----|
| Primary (액센트) | 청록/틸 | `#2fa184` |
| Primary Light | 밝은 틸 | `#3dd9a8` |
| Secondary | 소프트 블루 | `#4a87e8` |
| Warning | 앰버 | `#d4a11e` |
| Danger | 코럴 레드 | `#d95c4f` |
| BG Dark | 다크 네이비 | `#181b20` |
| BG Elevated | 진한 그레이 | `#1f232a` |
| FG | 라이트 그레이 | `#d7dce5` |

**로고 주색상: `#2fa184` (틸 그린)** — UI 전체의 스킬 노드, 액센트와 통일

---

## 3. 로고가 필요한 위치 & AI 생성 프롬프트

---

### LOGO-1. 메인 로고 (Primary Logo)

**사용 위치:** 사이드바 브랜드 블록, README, 마켓플레이스 페이지
**파일명:** `agentcanvas_logo.png`
**크기:** 512x512px (원본), 다운사이즈하여 사용
**배경:** 투명 (PNG)

**AI 이미지 생성 프롬프트:**

```
A modern, minimalist logo for a developer tool called "AgentCanvas".

The logo combines two visual concepts:
1. A stylized canvas/artboard shape — a rounded rectangle with subtle grid dots inside, representing a node-based visual editor workspace
2. An abstract AI agent symbol — a small geometric brain or neural node icon placed at the center of the canvas, with 3-4 thin connection lines radiating outward to smaller circular nodes at the edges

Style: Clean vector flat design, geometric shapes only, no gradients. Single-weight line art with filled accent shapes.

Color: Teal green (#2fa184) as the primary color on a transparent background. The connection lines and outer nodes use a lighter teal (#3dd9a8). The central brain/agent symbol is solid teal.

Mood: Technical, precise, modern — like n8n or Figma's visual identity. Professional developer tool aesthetic, not playful or cartoonish.

No text in the image. Icon only. Perfectly centered. Clean edges suitable for scaling down to 28x28px.
```

---

### LOGO-2. 사이드바 아이콘 (Sidebar Compact)

**사용 위치:** `LeftSidebar.tsx` — `.brand-logo` (28x28px 렌더링)
**파일명:** `agentcanvas_icon_28.png`
**크기:** 56x56px (@2x 레티나 대응)
**배경:** 투명

**AI 이미지 생성 프롬프트:**

```
A tiny 56x56 pixel app icon for "AgentCanvas", a node-based AI agent skill editor.

Ultra-simplified version of the main logo: just the central element — a small rounded square (canvas) with a single neural/connection node symbol inside (a dot with 3 short lines radiating from it, like a simplified circuit hub).

Flat vector style, single color teal (#2fa184) on transparent background.

Must be perfectly legible and recognizable at 28x28px display size. Extremely simple — maximum 5-6 visual elements total. No fine details. Thick, bold strokes.

Think of how VS Code, Figma, or Slack render their icons at sidebar scale — iconic, bold, instantly recognizable.
```

---

### LOGO-3. VS Code 확장 마켓플레이스 아이콘

**사용 위치:** `package.json`의 `"icon"` 필드 → VS Code 마켓플레이스 표시
**파일명:** `agentcanvas_marketplace.png`
**크기:** 128x128px (VS Code 요구사항)
**배경:** 어두운 네이비 (#181b20) 라운드 사각형

**AI 이미지 생성 프롬프트:**

```
A 128x128 pixel app icon for "AgentCanvas", a VS Code extension for visual AI agent management.

Design: A dark navy (#181b20) rounded square background (corner radius ~20%). Inside, the AgentCanvas logo in teal (#2fa184): a stylized canvas shape (rounded rectangle outline) with a central hub node connected by thin lines to 3-4 peripheral nodes, representing a node graph editor.

Style: Clean, flat, modern. Similar aesthetic to popular VS Code extensions like GitLens or Thunder Client icons. High contrast between dark background and teal icon.

The icon should look sharp and professional in VS Code's sidebar at small sizes (48px) and in the marketplace at full size (128px).

No text. No gradients. Solid shapes with clean edges.
```

---

### LOGO-4. 빈 캔버스 일러스트레이션 (Empty State)

**사용 위치:** `GraphView.tsx` — `.empty-placeholder` 영역
**파일명:** `agentcanvas_empty_state.png`
**크기:** 320x200px
**배경:** 투명

**AI 이미지 생성 프롬프트:**

```
A subtle, minimal illustration for an empty state screen of a node-based editor called "AgentCanvas".

Shows a lightly sketched canvas workspace with:
- Faint dot grid background pattern
- 2-3 ghost/placeholder node cards (rounded rectangles with dashed borders) arranged loosely
- Thin dashed connection lines between the ghost nodes
- A small "+" icon near one of the nodes suggesting "add your first node"

Color palette: Very muted teal (#2fa184 at 30% opacity) and soft gray (#d7dce5 at 20% opacity) on transparent background. The illustration should feel like a gentle suggestion/hint, not a prominent graphic.

Style: Ultra-minimal line art, almost wireframe-like. Think of Notion's or Linear's empty state illustrations — understated and elegant.

Wide aspect ratio: 320x200px. No text.
```

---

### LOGO-5. 로딩/폴백 페이지 로고

**사용 위치:** `extension.ts` — `fallbackHtml()` 함수 내 에러/로딩 화면
**파일명:** `agentcanvas_loading.svg`
**크기:** SVG (벡터, 가변 크기)
**배경:** 투명

**AI 이미지 생성 프롬프트:**

```
A simple SVG-style logo for "AgentCanvas" suitable for a dark loading/error screen.

The logo is a horizontal lockup: icon + text.
- Left: The AgentCanvas icon (canvas shape with central hub node, 3 connection lines)
- Right: The word "AgentCanvas" in a clean sans-serif font (like Inter or SF Pro), medium weight

Color: Teal (#2fa184) for the icon, light gray (#d7dce5) for the text. Both on transparent/dark background.

Style: Monoline, geometric, minimal. The icon and text should be vertically centered and feel like a single cohesive mark.

Total aspect ratio roughly 4:1 (wide horizontal). SVG-clean edges.
```

---

### LOGO-6. 파비콘 (Webview Tab)

**사용 위치:** VS Code 탭 아이콘으로 표시
**파일명:** `agentcanvas_favicon.png`
**크기:** 32x32px
**배경:** 투명

**AI 이미지 생성 프롬프트:**

```
A 32x32 pixel favicon for "AgentCanvas".

Extremely simplified: a single rounded square outline in teal (#2fa184) with a tiny dot at the center and 2 short lines extending from it, suggesting a node connection.

Must be pixel-perfect and readable at 16x16px. Maximum 3-4 visual elements. Bold strokes (2-3px at 32x32 scale).

Flat, no shadows, no gradients. Transparent background.
```

---

### LOGO-7. 노드 타입 아이콘 세트

**사용 위치:** 각 노드 카드 헤더 (SkillNode, RuleDocNode, AgentNode, ProviderNode, FolderNode, NoteNode)
**파일명:** `icon_skill.svg`, `icon_rule.svg`, `icon_agent.svg`, `icon_provider.svg`, `icon_folder.svg`, `icon_note.svg`
**크기:** 각 16x16px (SVG)
**배경:** 투명

이 세트는 Lucide React 아이콘 라이브러리 사용을 권장하지만, 커스텀 제작 시 아래 프롬프트 활용:

**AI 이미지 생성 프롬프트:**

```
A set of 6 minimal monoline icons for a node-based AI editor, each 16x16px, designed as a cohesive icon family:

1. SKILL icon: A lightning bolt inside a small rounded square. Color: teal (#2fa184)
2. RULE icon: A document/scroll with a small checkmark. Color: amber (#de9f30)
3. AGENT icon: A simplified robot head (circle with two dot eyes and a small antenna). Color: blue (#4a87e8)
4. PROVIDER icon: A cloud shape with a small connection dot below it. Color: soft blue (#5875a4)
5. FOLDER icon: A classic folder shape, slightly open. Color: indigo (#6d7fd8)
6. NOTE icon: A sticky note / memo pad with one corner folded. Color: gold (#b98516)

Style: All icons share the same line weight (1.5px stroke), corner radius, and padding. Monoline outline style, not filled. Think of Lucide or Feather icon aesthetic.

Each icon should be centered in its 16x16 bounding box with 1px padding. Clean geometric shapes. No fine details — must be legible at 12px.

Arrange all 6 in a horizontal strip for presentation, with labels below each.
```

---

## 4. 슬로건 변경

| 현재 | 제안 |
|------|------|
| `Discover / Visualize / Share` | `Design · Connect · Deploy` |

"Design"은 스킬 생성, "Connect"는 노드 연결/시각화, "Deploy"는 팩 내보내기/공유를 나타냅니다.

---

## 5. 적용 체크리스트

### 로고 파일 교체

- [ ] `webview-ui/src/assets/nano_banana_logo.png` → `agentcanvas_icon_28.png`
- [ ] `package.json`에 `"icon": "media/agentcanvas_marketplace.png"` 추가
- [ ] `media/` 폴더 생성 후 마켓플레이스 아이콘 배치
- [ ] empty-placeholder에 일러스트 삽입
- [ ] fallback HTML에 SVG 로고 인라인 삽입

### 코드 네이밍 변경 (총 25개 지점)

- [ ] `package.json` — name, displayName, description, commands, config keys
- [ ] `extension.ts` — command IDs, viewType, panel title, error messages, config keys, storage key
- [ ] `zipPack.ts` — manifest name
- [ ] `LeftSidebar.tsx` — import 경로, alt 텍스트, 브랜드 타이틀, 슬로건
- [ ] `index.html` — title
- [ ] `.vscode/launch.json` — launch config name, preLaunchTask
- [ ] `.vscode/tasks.json` — task label
- [ ] `README.md` — 전체 문서

### 디자인 토큰 통합

- [ ] CSS 변수에 노드 색상 추가 (`--color-skill`, `--color-rule` 등)
- [ ] GraphView.tsx 엣지 색상을 CSS 변수로 교체
- [ ] 노드 카드 헤더에 아이콘 컴포넌트 추가
