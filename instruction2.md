아래는 **Codex가 그대로 구현할 수 있게** “와이어프레임(ASCII) + 노드 컴포넌트 설계(Props/Data) + 메시지 프로토콜(protocol.ts) 초안”을 한 번에 정리한 문서/코드입니다.
(너가 이전에 원한 n8n 느낌: **좌측 네비 + 상단 바 + 도트 그리드 캔버스 + 우측 패널(노드 라이브러리/인스펙터)** + 플로팅 컨트롤 + 커맨드바 오버레이 구조를 반영)

---

# 1) 메인 화면 UI 와이어프레임(ASCII)

## 1.1 기본 레이아웃(노드가 존재하는 상태)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (44px)                                                                            │
│ [Agent Studio]  [Active: Codex / default]  (🔄 Refresh) (⬆ Export Pack) (⬇ Import Pack)   │
│ (✅ Validate)   (⚙ Settings)   [Search ⌘K]                                                  │
├───────────────┬───────────────────────────────────────────────────────┬───────────────────┤
│ LEFT SIDEBAR  │ CANVAS (dot-grid background)                           │ RIGHT PANEL       │
│ (260px)       │                                                       │ (360px, resizable)│
│               │   ┌─────────┐        ┌──────────┐                     │  Tabs:            │
│ Providers     │   │ AGENT    │──contains──▶│ SKILL     │               │  [Inspector] [ + ]│
│  • AgentSkills│   │ Codex    │              │ web-test  │               │                   │
│  • Codex      │   └─────────┘              └──────────┘               │  Inspector         │
│  • OpenClaw(?)│        │ overrides                                      │  ─────────         │
│               │        ▼                                                │  Type: SKILL       │
│ Agents        │   ┌───────────┐                                        │  Name: web-test    │
│  • default    │   │ RULEDOC    │                                        │  Desc: ...         │
│  • work       │   │ AGENTS.md  │                                        │  Scope: project    │
│               │   └───────────┘                                        │  Path: ...         │
│ Skills        │        │ overrides                                      │                   │
│  • (project)  │        ▼                                                │  Actions           │
│  • (personal) │   ┌────────────────┐                                   │  [Open] [Reveal]   │
│               │   │ RULEDOC         │                                   │  [Validate]        │
│ Packs         │   │ AGENTS.override │                                   │  [Export Skill]    │
│  • recent     │   └────────────────┘                                   │                   │
│               │                                                       │  Validation         │
│               │                                                       │  Errors: 0          │
│               │                                                       │  Warnings: 1        │
│               │                                                       │    - ...            │
│               │                                                       │                   │
├───────────────┴───────────────────────────────────────────────────────┴───────────────────┤
│ STATUS BAR (24px): Skills=12  Rules=4  Errors=1  Warnings=3   (Focus: Canvas)             │
└──────────────────────────────────────────────────────────────────────────────────────────┘

Canvas floating controls (bottom-right, overlay):
  [Fit(1)] [Zoom+ (+)] [Zoom- (-)] [Reset(0)] [Tidy]    [ + ] Node Library toggle
```

### 동작 규칙

* **좌측 사이드바** : Providers/Agents/Skills/Packs/Settings 섹션. 섹션 접기/펼치기.
* **상단 바** : 전역 액션(Refresh, Export/Import, Validate) + Command Bar(⌘K) 트리거.
* **캔버스** : 도트 그리드 + 드래그 팬/줌/노드 선택 + 엣지 표시.
* **우측 패널** : 탭 2개
* `Inspector`: 선택된 노드 상세/편집
* `+`(Node Library): “새 노드” 기능(새 Skill 생성, Note 추가, Rule override 생성 등)
* **Status bar** : 현재 탐지된 수/오류 요약/포커스 상태 표시.

---

## 1.2 빈 상태(아직 아무 것도 탐지 못한 경우)

```
CANVAS (dot grid)
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Add first step                                        │  │
│  │                                                       │  │
│  │  [Scan workspace]   [Create new Skill]   [Import Pack] │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Tips:                                                      │
│   - Put skills in .github/skills/<name>/SKILL.md            │
│   - Add AGENTS.md for Codex guidance                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 1.3 Right Panel: Node Library 모드(“n8n nodes panel” 느낌)

```
RIGHT PANEL (Node Library)
┌───────────────────────────────────────────────┐
│ Tabs: [Inspector] [ + Node Library ]          │
├───────────────────────────────────────────────┤
│ Search: [ web...                          ]   │
│                                               │
│ Categories                                    │
│  ▸ Skills                                      │
│     • New Skill (wizard)                       │
│     • Import Skill Pack                        │
│  ▸ Rules                                       │
│     • Create AGENTS.override.md (here)         │
│  ▸ Notes                                       │
│     • Sticky Note                              │
│  ▸ Utilities                                   │
│     • Folder Marker (skills root)              │
│                                               │
│ (Drag items onto canvas where possible)        │
└───────────────────────────────────────────────┘
```

---

## 1.4 Command Bar Overlay(⌘K / Ctrl+K)

```
(overlay centered)
┌──────────────────────────────────────────────────────────────┐
│ Command: [ export pack ...                                ]  │
├──────────────────────────────────────────────────────────────┤
│ • Refresh discovery                                          │
│ • Validate all skills                                        │
│ • Export selected skills as pack                             │
│ • Import skill pack                                          │
│ • Create new skill                                           │
│ • Create AGENTS.override.md in current dir                   │
│ • Toggle Node Library                                        │
│ • Tidy layout                                                │
└──────────────────────────────────────────────────────────────┘
```

---

# 2) 노드 타입 설계(컴포넌트/props/data)

## 2.1 공통 타입(React Flow data shape)

> 핵심: **모든 노드 data는 직렬화 가능(JSON)** 해야 하므로 함수/클래스/Date 객체 지양(ISO string 사용).

```ts
// webview-ui/src/canvas/types.ts
export type NodeKind = 'agent' | 'skill' | 'ruleDoc' | 'note' | 'folder';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  code: string;          // e.g. "SKILL_NAME_MISMATCH"
  message: string;
  file?: string;         // "SKILL.md"
  line?: number;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  lastValidatedAt?: string; // ISO
}

export interface BaseNodeData {
  kind: NodeKind;
  title: string;             // primary label
  subtitle?: string;         // secondary label
  badgeText?: string;        // e.g. "project", "personal", "global"
  status?: 'ok' | 'warn' | 'error' | 'unknown';
  providerId?: string;       // "codex" | "agentSkills" | "openclaw" ...
  path?: string;             // uri string (vscode.Uri.toString())
  selectable?: boolean;
}
```

---

## 2.2 SkillNode

### 데이터

```ts
export type SkillScope = 'project' | 'personal' | 'shared' | 'unknown';

export interface SkillNodeData extends BaseNodeData {
  kind: 'skill';
  skillId: string;               // stable id (e.g. hash of path) or uuid
  name: string;                  // frontmatter name
  description: string;           // frontmatter description
  scope: SkillScope;
  rootDirUri: string;            // skill folder uri
  skillMdUri: string;            // SKILL.md uri
  enabled?: boolean;             // best-effort; may be undefined if runtime doesn't support toggle
  validation?: ValidationResult;
  extraFrontmatter?: Record<string, unknown>; // preserve unknown fields
}
```

### 컴포넌트 Props

```ts
// webview-ui/src/canvas/nodes/SkillNode.tsx
import type { NodeProps } from 'reactflow';
import type { SkillNodeData } from '../types';

export type SkillNodeProps = NodeProps<SkillNodeData>;
```

### UI 규칙(구현 지침)

* 상단: title = `name`
* subtitle = `description`(1~2줄 ellipsis)
* badge: scope(project/personal/shared)
* 상태 아이콘:
  * validation ok → ✅
  * warnings only → ⚠️
  * errors → ⛔
* hover action bar(우상단):
  * Open
  * Enable/Disable(가능할 때만)
  * More(⋯)

---

## 2.3 RuleDocNode

### 데이터

```ts
export type RuleDocType =
  | 'codex-agents'
  | 'codex-agents-override'
  | 'openclaw-agents'
  | 'openclaw-soul'
  | 'openclaw-user'
  | 'openclaw-tools'
  | 'unknown';

export type RuleScope = 'global' | 'project' | 'agent-workspace' | 'unknown';

export interface RuleDocNodeData extends BaseNodeData {
  kind: 'ruleDoc';
  ruleDocId: string;
  docType: RuleDocType;
  scope: RuleScope;
  orderIndex: number;          // chain order for overrides visualization
  uri: string;                 // file uri
  exists: boolean;             // false면 “Create” CTA 표시 가능
}
```

### UI 규칙

* title = AGENTS.md / SOUL.md 등 파일명
* subtitle = scope + (override 여부)
* hover actions:
  * Open(존재 시)
  * Create override(존재하지 않거나 생성 가능한 위치면)
  * More(⋯)

---

## 2.4 AgentNode

### 데이터

```ts
export interface AgentNodeData extends BaseNodeData {
  kind: 'agent';
  agentId: string;               // provider-specific id
  displayName: string;           // "Codex / default"
  providerId: string;            // "codex", "openclaw", ...
  workspaceRootUri?: string;
  homeDirUri?: string;
}
```

### UI 규칙

* title = provider + profile
* subtitle = workspace root(있으면)
* hover actions:
  * Set active
  * Refresh only this agent
  * More

---

## 2.5 NoteNode (Sticky note)

```ts
export interface NoteNodeData extends BaseNodeData {
  kind: 'note';
  noteId: string;
  text: string;
  // optional: width/height persisted by reactflow node size state
}
```

UI 규칙:

* 클릭 시 인라인 편집(간단 textarea)
* hover actions: delete note, duplicate note

---

## 2.6 FolderNode (스킬 루트/마커)

```ts
export interface FolderNodeData extends BaseNodeData {
  kind: 'folder';
  folderId: string;
  folderUri: string;
  label: string;
}
```

---

## 2.7 Edge 설계(contains/overrides/locatedIn)

```ts
export type EdgeKind = 'contains' | 'overrides' | 'locatedIn';

export interface GraphEdgeData {
  kind: EdgeKind;
  label?: string;           // e.g. "overrides"
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: 'smoothstep' | 'step' | 'default';
  data: GraphEdgeData;
}
```

UI 규칙:

* `overrides` 엣지는 점선(dashed) 스타일 추천
* `contains`는 일반 실선
* `locatedIn`는 옅게(투명도) 표시

(색상 고정하지 말고 **VS Code theme variable** 기반으로 CSS 작성)

---

# 3) Inspector 패널 스펙(노드별 상세 UI)

## 3.1 Skill Inspector

```
[Skill Inspector]
- Header: name + scope badge + enabled toggle(가능 시)
- Path: rootDirUri (copy button)
- Files: SKILL.md (open)
- Validation summary:
   ok? / errors count / warnings count / lastValidatedAt
   issue list (severity icon + message)
- Actions:
   [Open SKILL.md] [Reveal folder] [Validate]
   [Export skill]  [Copy as pack snippet] (optional)
- Frontmatter editor (MVP-lite):
   name (readonly if mismatch? editable 가능)
   description
   (advanced) raw yaml editor toggle
```

## 3.2 RuleDoc Inspector

```
[RuleDoc Inspector]
- Header: filename + scope badge + orderIndex
- Path: uri
- Chain:
   show previous/next docs in chain
- Actions:
   [Open] [Create override here] [Reveal]
```

## 3.3 Agent Inspector

```
[Agent Inspector]
- Header: provider/profile + "Active" badge
- Workspace root
- Home dir
- Counts: skills/rules
- Actions: [Set active] [Refresh agent]
```

---

# 4) 캔버스 조작/단축키 스펙(프론트엔드 구현 체크)

## 4.1 기본

* 팬:
  * Space + drag
  * Middle mouse drag
  * (가능하면) Ctrl + drag
* 줌:
  * Ctrl+Wheel
  * `+` / `-`
  * `0` Reset
  * `1` Fit
* 탭:
  * `Tab` → Node Library 토글
* 노트:
  * `Shift+S` → Sticky note 생성(캔버스 중앙에 생성)

> VS Code webview에서 충돌나는 키는 “webview focus”일 때만 처리. 실패하면 상단의 🔍 버튼으로도 Command Bar 열기.

---

# 5) 메시지 프로토콜 `protocol.ts` 초안 (Codex가 바로 붙여넣기 가능)

> **권장** : `common/protocol.ts`로 공유하고, extension과 webview가 같은 타입을 import하게 구성.
> (MVP에서는 복사해도 OK)

아래 파일을 생성:

* `extension/src/messages/protocol.ts`
* `webview-ui/src/messaging/protocol.ts` (동일 내용)

```ts
/* protocol.ts - shared message protocol between extension host and webview */

export type IsoDateString = string;
export type UriString = string;
export type RequestId = string;

export type ProviderId = 'agentSkills' | 'codex' | 'openclaw' | 'unknown';

export type NodeKind = 'agent' | 'skill' | 'ruleDoc' | 'note' | 'folder';
export type EdgeKind = 'contains' | 'overrides' | 'locatedIn';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  code: string;
  message: string;
  file?: string;
  line?: number;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  lastValidatedAt?: IsoDateString;
}

/** ===== Entities ===== */

export type SkillScope = 'project' | 'personal' | 'shared' | 'unknown';

export interface SkillEntity {
  skillId: string;
  name: string;
  description: string;
  scope: SkillScope;
  providerId: ProviderId;

  rootDirUri: UriString;
  skillMdUri: UriString;

  enabled?: boolean;
  validation?: ValidationResult;

  // preserve runtime-specific frontmatter fields without losing them
  extraFrontmatter?: Record<string, unknown>;
}

export type RuleDocType =
  | 'codex-agents'
  | 'codex-agents-override'
  | 'openclaw-agents'
  | 'openclaw-soul'
  | 'openclaw-user'
  | 'openclaw-tools'
  | 'unknown';

export type RuleScope = 'global' | 'project' | 'agent-workspace' | 'unknown';

export interface RuleDocEntity {
  ruleDocId: string;
  docType: RuleDocType;
  scope: RuleScope;
  orderIndex: number;

  uri: UriString;
  exists: boolean;
  providerId: ProviderId;
}

export interface AgentProfileEntity {
  agentId: string;
  displayName: string;          // "Codex / default"
  providerId: ProviderId;

  workspaceRootUri?: UriString;
  homeDirUri?: UriString;
}

/** ===== Graph snapshot (serializable) ===== */

export interface XYPosition {
  x: number;
  y: number;
}

export interface BaseNodeData {
  kind: NodeKind;
  title: string;
  subtitle?: string;
  badgeText?: string;
  status?: 'ok' | 'warn' | 'error' | 'unknown';
  providerId?: ProviderId;
  path?: UriString;
}

export interface AgentNodeData extends BaseNodeData {
  kind: 'agent';
  agentId: string;
  displayName: string;
  workspaceRootUri?: UriString;
  homeDirUri?: UriString;
}

export interface SkillNodeData extends BaseNodeData {
  kind: 'skill';
  skillId: string;
  name: string;
  description: string;
  scope: SkillScope;
  rootDirUri: UriString;
  skillMdUri: UriString;
  enabled?: boolean;
  validation?: ValidationResult;
  extraFrontmatter?: Record<string, unknown>;
}

export interface RuleDocNodeData extends BaseNodeData {
  kind: 'ruleDoc';
  ruleDocId: string;
  docType: RuleDocType;
  scope: RuleScope;
  orderIndex: number;
  uri: UriString;
  exists: boolean;
}

export interface NoteNodeData extends BaseNodeData {
  kind: 'note';
  noteId: string;
  text: string;
}

export interface FolderNodeData extends BaseNodeData {
  kind: 'folder';
  folderId: string;
  folderUri: UriString;
  label: string;
}

export type NodeData =
  | AgentNodeData
  | SkillNodeData
  | RuleDocNodeData
  | NoteNodeData
  | FolderNodeData;

export interface GraphNode<TData extends NodeData = NodeData> {
  id: string;
  type: NodeKind;       // reactflow nodeTypes key
  position: XYPosition;
  data: TData;

  // optional reactflow flags (keep serializable)
  selected?: boolean;
}

export interface GraphEdgeData {
  kind: EdgeKind;
  label?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: 'smoothstep' | 'step' | 'default';
  data: GraphEdgeData;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** ===== UI state ===== */

export type RightPanelTab = 'inspector' | 'library';

export interface UiState {
  rightPanelTab: RightPanelTab;
  selectedNodeId?: string;
  commandBarOpen: boolean;
  lastRefreshedAt?: IsoDateString;

  // canvas state (optional)
  zoom?: number;
  pan?: XYPosition;
}

export interface StudioState {
  agents: AgentProfileEntity[];
  selectedAgentId?: string;

  skills: SkillEntity[];
  ruleDocs: RuleDocEntity[];

  graph: GraphSnapshot;
  ui: UiState;

  // counts summary for status bar
  summary: {
    skills: number;
    ruleDocs: number;
    errors: number;
    warnings: number;
  };
}

/** ===== Message envelope ===== */

export interface BaseMessage {
  type: string;
  requestId?: RequestId;   // if present => caller expects a response
  inReplyTo?: RequestId;   // response references the request
}

/** ===== Webview -> Extension messages ===== */

export interface ReadyMsg extends BaseMessage {
  type: 'READY';
}

export interface RefreshMsg extends BaseMessage {
  type: 'REFRESH';
  agentId?: string; // if omitted, refresh all
}

export interface SetActiveAgentMsg extends BaseMessage {
  type: 'SET_ACTIVE_AGENT';
  agentId: string;
}

export interface OpenFileMsg extends BaseMessage {
  type: 'OPEN_FILE';
  uri: UriString;
}

export interface RevealInExplorerMsg extends BaseMessage {
  type: 'REVEAL_IN_EXPLORER';
  uri: UriString;
}

export interface CreateSkillMsg extends BaseMessage {
  type: 'CREATE_SKILL';
  baseDirUri: UriString;      // where to create folder
  name: string;               // folder name + frontmatter name
  description: string;
  // optional advanced fields
  extraFrontmatter?: Record<string, unknown>;
}

export interface UpdateSkillFrontmatterMsg extends BaseMessage {
  type: 'UPDATE_SKILL_FRONTMATTER';
  skillId: string;
  patch: {
    name?: string;
    description?: string;
    extraFrontmatter?: Record<string, unknown>;
  };
}

export interface ValidateSkillMsg extends BaseMessage {
  type: 'VALIDATE_SKILL';
  skillId: string;
}

export interface ValidateAllSkillsMsg extends BaseMessage {
  type: 'VALIDATE_ALL_SKILLS';
}

export interface SetSkillEnabledMsg extends BaseMessage {
  type: 'SET_SKILL_ENABLED';
  skillId: string;
  enabled: boolean;
}

export interface CreateAgentsOverrideMsg extends BaseMessage {
  type: 'CREATE_AGENTS_OVERRIDE';
  // create in this directory
  dirUri: UriString;
  // optional initial content
  template?: 'empty' | 'copy-current' | 'starter';
}

export interface ExportPackMsg extends BaseMessage {
  type: 'EXPORT_PACK';
  skillIds: string[];
  outputUri: UriString; // file uri for zip output
  packMeta?: {
    name?: string;
    version?: string;
  };
}

export interface ImportPackMsg extends BaseMessage {
  type: 'IMPORT_PACK';
  zipUri: UriString;
  installDirUri: UriString;  // e.g. workspace/.github/skills
  conflictPolicy?: 'suffix' | 'overwrite' | 'cancel'; // default suffix
}

export interface SaveNoteMsg extends BaseMessage {
  type: 'SAVE_NOTE';
  noteId: string;
  text: string;
}

export interface DeleteNoteMsg extends BaseMessage {
  type: 'DELETE_NOTE';
  noteId: string;
}

export type MessageFromWebview =
  | ReadyMsg
  | RefreshMsg
  | SetActiveAgentMsg
  | OpenFileMsg
  | RevealInExplorerMsg
  | CreateSkillMsg
  | UpdateSkillFrontmatterMsg
  | ValidateSkillMsg
  | ValidateAllSkillsMsg
  | SetSkillEnabledMsg
  | CreateAgentsOverrideMsg
  | ExportPackMsg
  | ImportPackMsg
  | SaveNoteMsg
  | DeleteNoteMsg;

/** ===== Extension -> Webview messages ===== */

export interface InitStateMsg extends BaseMessage {
  type: 'INIT_STATE';
  state: StudioState;
}

export interface StatePatchMsg extends BaseMessage {
  type: 'STATE_PATCH';
  patch: Partial<StudioState>;
  // optional: patch semantics hints (MVP can ignore)
  mode?: 'merge' | 'replaceGraph';
}

export interface ToastMsg extends BaseMessage {
  type: 'TOAST';
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface ErrorMsg extends BaseMessage {
  type: 'ERROR';
  message: string;
  detail?: string;
}

export interface ResponseOkMsg extends BaseMessage {
  type: 'RESPONSE_OK';
  inReplyTo: RequestId;
  result?: unknown;
}

export interface ResponseErrorMsg extends BaseMessage {
  type: 'RESPONSE_ERROR';
  inReplyTo: RequestId;
  error: { message: string; detail?: string };
}

export type MessageFromExtension =
  | InitStateMsg
  | StatePatchMsg
  | ToastMsg
  | ErrorMsg
  | ResponseOkMsg
  | ResponseErrorMsg;

/** ===== Type guards ===== */

export function isMessageFromWebview(x: any): x is MessageFromWebview {
  return x && typeof x.type === 'string' && !('state' in x) && !('patch' in x && x.type === 'STATE_PATCH');
}

export function isMessageFromExtension(x: any): x is MessageFromExtension {
  return x && typeof x.type === 'string' && (x.type === 'INIT_STATE' || x.type === 'STATE_PATCH' || x.type === 'TOAST' || x.type === 'ERROR' || x.type.startsWith('RESPONSE_'));
}
```

---

# 6) Webview 메시징 브리지(vscodeBridge) 초안

`webview-ui/src/messaging/vscodeBridge.ts`

```ts
import type {
  MessageFromExtension,
  MessageFromWebview,
  RequestId,
  ResponseOkMsg,
  ResponseErrorMsg,
} from './protocol';

declare const acquireVsCodeApi: any;

type Pending = {
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  timeoutHandle: number;
};

export class VsCodeBridge {
  private vscode = acquireVsCodeApi();
  private pending = new Map<RequestId, Pending>();

  constructor() {
    window.addEventListener('message', (event) => {
      const msg = event.data as MessageFromExtension;
      this.onMessage(msg);
    });
  }

  post(msg: MessageFromWebview) {
    this.vscode.postMessage(msg);
  }

  request<T = any>(msg: MessageFromWebview, timeoutMs = 15000): Promise<T> {
    const requestId = this.newRequestId();
    const withId = { ...msg, requestId } as MessageFromWebview;

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Request timeout: ${msg.type}`));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timeoutHandle });
      this.vscode.postMessage(withId);
    });
  }

  private onMessage(msg: MessageFromExtension) {
    if (msg.type === 'RESPONSE_OK') {
      const m = msg as ResponseOkMsg;
      const p = this.pending.get(m.inReplyTo);
      if (!p) return;
      window.clearTimeout(p.timeoutHandle);
      this.pending.delete(m.inReplyTo);
      p.resolve(m.result);
      return;
    }

    if (msg.type === 'RESPONSE_ERROR') {
      const m = msg as ResponseErrorMsg;
      const p = this.pending.get(m.inReplyTo);
      if (!p) return;
      window.clearTimeout(p.timeoutHandle);
      this.pending.delete(m.inReplyTo);
      p.reject(new Error(m.error.detail ? `${m.error.message}\n${m.error.detail}` : m.error.message));
      return;
    }

    // Non-response messages should be handled by app-level store reducer
    // e.g. INIT_STATE / STATE_PATCH / TOAST / ERROR
  }

  private newRequestId(): RequestId {
    return `req_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}
```

---

# 7) Extension 측 메시지 핸들러 skeleton

`extension/src/extension.ts` 내부(요약)

```ts
import * as vscode from 'vscode';
import type { MessageFromWebview, MessageFromExtension } from './messages/protocol';

function respondOk(panel: vscode.WebviewPanel, inReplyTo: string, result?: unknown) {
  panel.webview.postMessage({ type: 'RESPONSE_OK', inReplyTo, result } satisfies MessageFromExtension);
}
function respondErr(panel: vscode.WebviewPanel, inReplyTo: string, message: string, detail?: string) {
  panel.webview.postMessage({
    type: 'RESPONSE_ERROR',
    inReplyTo,
    error: { message, detail },
  } satisfies MessageFromExtension);
}

panel.webview.onDidReceiveMessage(async (msg: MessageFromWebview) => {
  try {
    switch (msg.type) {
      case 'READY': {
        // send INIT_STATE
        break;
      }
      case 'REFRESH': {
        // run discovery, then STATE_PATCH({graph, skills, ruleDocs, summary})
        if (msg.requestId) respondOk(panel, msg.requestId);
        break;
      }
      case 'OPEN_FILE': {
        await vscode.window.showTextDocument(vscode.Uri.parse(msg.uri), { preview: false });
        if (msg.requestId) respondOk(panel, msg.requestId);
        break;
      }
      default: {
        if (msg.requestId) respondErr(panel, msg.requestId, `Unhandled message type: ${msg.type}`);
      }
    }
  } catch (e: any) {
    if (msg.requestId) respondErr(panel, msg.requestId, e?.message ?? 'Unknown error', String(e));
    else panel.webview.postMessage({ type: 'ERROR', message: e?.message ?? 'Unknown error', detail: String(e) });
  }
});
```

---

# 8) (보너스) 캔버스 CSS: “n8n 느낌” 도트 그리드(테마 친화)

> 색 고정 금지. **VS Code theme variable** 기반으로 도트를 만든다.

```css
/* webview-ui/src/styles/canvas.css */
.canvasRoot {
  height: 100%;
  width: 100%;
  background-color: var(--vscode-editor-background);
  background-image:
    radial-gradient(
      rgba(127, 127, 127, 0.22) 1px,
      transparent 1px
    );
  background-size: 18px 18px;
}

/* hover action bar: use theme foreground but low alpha */
.nodeActionBar {
  background: color-mix(in srgb, var(--vscode-editor-background) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 18%, transparent);
  border-radius: 6px;
}
```

---

원하면 다음도 바로 써줄게요(= Codex에 그대로 넘길 수 있는 수준):

1. **Graph 자동 레이아웃(Tidy) 규칙** (Agent 왼쪽, Rule 체인 아래로, Skills 오른쪽)과 dagre 설정값
2. **Skill 생성 마법사 UI(폼) + 템플릿 SKILL.md 생성 로직(gray-matter 포함)**
3. **Codex AGENTS 체인 탐지 알고리즘을 정확히 구현한 코드(경로 탐색/override 우선순위/캐시)**
