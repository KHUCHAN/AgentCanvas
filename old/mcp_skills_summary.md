# CLI Agents: Skills & MCP Integration Guide

## gemini_cli
### ### Extensions
**Enabled/Disabled** | Default: disabled

If disabled, users will not be able to use or install extensions. See
[Extensions](../extensions/index.md) for more details.

### ### MCP


### #### Enabled/Disabled
**Enabled/Disabled** | Default: disabled

If disabled, users will not be able to use MCP servers. See
[MCP Server Integration](../tools/mcp-server.md) for more details.

### #### MCP Servers (preview)
**Default**: empty

Allows administrators to define an explicit allowlist of MCP servers. This
guarantees that users can only connect to trusted MCP servers defined by the
organization.

**Allowlist Format:**

```json
{
  "mcpServers": {
    "external-provider": {
      "url": "https://api.mcp-provider.com",
      "type": "sse",
      "trust": true,
      "includeTools": ["toolA", "toolB"],
      "excludeTools": []
    },
    "internal-corp-tool": {
      "url": "https://mcp.internal-tool.corp",
      "type": "http",
      "includeTools": [],
      "excludeTools": ["adminTool"]
    }
  }
}
```

**Supported Fields:**

- `url`: (Required) The full URL of the MCP server endpoint.
- `type`: (Required) The connection type (e.g., `sse` or `http`).
- `trust`: (Optional) If set to `true`, the server is trusted and tool execution
  will not require user approval.
- `includeTools`: (Optional) An explicit list of tool names to allow. If
  specified, only these tools will be available.
- `excludeTools`: (Optional) A list of tool names to hide. These tools will be
  blocked.

**Client Enforcement Logic:**

- **Empty Allowlist**: If the admin allowlist is empty, the client uses the
  user’s local configuration as is (unless the MCP toggle above is disabled).
- **Active Allowlist**: If the allowlist contains one or more servers, **all
  locally configured servers not present in the allowlist are ignored**.
- **Configuration Merging**: For a server to be active, it must exist in
  **both** the admin allowlist and the user’s local configuration (matched by
  name). The client merges these definitions as follows:
  - **Override Fields**: The `url`, `type`, & `trust` are always taken from the
    admin allowlist, overriding any local values.
  - **Tools Filtering**: If `includeTools` or `excludeTools` are defined in the
    allowlist, the admin’s rules are used exclusively. If both are undefined in
    the admin allowlist, the client falls back to the user’s local tool
    settings.
 ...
[Truncated]

### ### Unmanaged Capabilities
**Enabled/Disabled** | Default: disabled

If disabled, users will not be able to use certain features. Currently, this
control disables Agent Skills. See [Agent Skills](../cli/skills.md) for more
details.

### ## Announcements: v0.29.0 - 2026-02-17
- **Plan Mode:** A new comprehensive planning capability with `/plan`,
  `enter_plan_mode` tool, and dedicated documentation
  ([#17698](https://github.com/google-gemini/gemini-cli/pull/17698) by @Adib234,
  [#18324](https://github.com/google-gemini/gemini-cli/pull/18324) by @jerop).
- **Gemini 3 Default:** We've removed the preview flag and enabled Gemini 3 by
  default for all users
  ([#18414](https://github.com/google-gemini/gemini-cli/pull/18414) by
  @sehoon38).
- **Extension Exploration:** New UI and settings to explore and manage
  extensions more easily
  ([#18686](https://github.com/google-gemini/gemini-cli/pull/18686) by
  @sripasg).
- **Admin Control:** Administrators can now allowlist specific MCP server
  configurations
  ([#18311](https://github.com/google-gemini/gemini-cli/pull/18311) by
  @skeshive).

### ## Announcements: v0.26.0 - 2026-01-27
- **Agents and Skills:** We've introduced a new `skill-creator` skill
  ([#16394](https://github.com/google-gemini/gemini-cli/pull/16394) by
  @NTaylorMullen), enabled agent skills by default, and added a generalist agent
  to improve task routing
  ([#16638](https://github.com/google-gemini/gemini-cli/pull/16638) by
  @joshualitt).
- **UI/UX Improvements:** You can now "Rewind" through your conversation history
  ([#15717](https://github.com/google-gemini/gemini-cli/pull/15717) by @Adib234)
  and use a new `/introspect` command for debugging.
- **Core and Scheduler Refactoring:** The core scheduler has been significantly
  refactored to improve performance and reliability
  ([#16895](https://github.com/google-gemini/gemini-cli/pull/16895) by
  @abhipatel12), and numerous performance and stability fixes have been
  included.

### ## Announcements: v0.25.0 - 2026-01-20
- **Skills and Agents Improvements:** We've enhanced the `activate_skill` tool,
  added a new `pr-creator` skill
  ([#16232](https://github.com/google-gemini/gemini-cli/pull/16232) by
  [@NTaylorMullen](https://github.com/NTaylorMullen)), enabled skills by
  default, improved the `cli_help` agent
  ([#16100](https://github.com/google-gemini/gemini-cli/pull/16100) by
  [@scidomino](https://github.com/scidomino)), and added a new `/agents refresh`
  command ([#16204](https://github.com/google-gemini/gemini-cli/pull/16204) by
  [@joshualitt](https://github.com/joshualitt)).
- **UI/UX Refinements:** You'll notice more transparent feedback for skills
  ([#15954](https://github.com/google-gemini/gemini-cli/pull/15954) by
  [@NTaylorMullen](https://github.com/NTaylorMullen)), the ability to switch
  focus between the shell and input with Tab
  ([#14332](https://github.com/google-gemini/gemini-cli/pull/14332) by
  [@jacob314](https://github.com/jacob314)), and dynamic terminal tab titles
  ([#16378](https://github.com/google-gemini/gemini-cli/pull/16378) by
  [@NTaylorMullen](https://github.com/NTaylorMullen)).
- **Core Functionality & Performance:** This release includes support for
  built-in agent skills
  ([#16045](https://github.com/google-gemini/gemini-cli/pull/16045) by
  [@NTaylorMullen](https://github.com/NTaylorMullen)), refined Gemini 3 system
  instructions ([#16139](https://github.com/google-gemini/gemini-cli/pull/16139)
  by [@NTaylorMullen](https://github.com/NTaylorMullen)), caching for ignore
  instances to improve performance
  ([#16185](https://github.com/google-gemini/gemini-cli/pull/16185) by
  [@EricRahm](https://github.com/EricRahm)), and enhanced retry mechanisms
  ([#16489](https://github.com/google-gemini/gemini-cli/pull/16489) by
  [@sehoon38](https://github.com/sehoon38)).
- **Bug Fixes and Stability:** We've squashed numerous bugs across the CLI,
  core, and workflows, addressing issues with subagent delegation, unicode
  character crashes, and ...
[Truncated]

### ## Announcements: v0.24.0 - 2026-01-14
- **Agent Skills:** We've introduced significant advancements in Agent Skills.
  This includes initial documentation and tutorials to help you get started,
  alongside enhanced support for remote agents, allowing for more distributed
  and powerful automation within Gemini CLI.
  ([#15869](https://github.com/google-gemini/gemini-cli/pull/15869) by
  [@NTaylorMullen](https://github.com/NTaylorMullen)),
  ([#16013](https://github.com/google-gemini/gemini-cli/pull/16013) by
  [@adamweidman](https://github.com/adamweidman))
- **Improved UI/UX:** The user interface has received several updates, featuring
  visual indicators for hook execution, a more refined display for settings, and
  the ability to use the Tab key to effortlessly switch focus between the shell
  and input areas.
  ([#15408](https://github.com/google-gemini/gemini-cli/pull/15408) by
  [@abhipatel12](https://github.com/abhipatel12)),
  ([#14332](https://github.com/google-gemini/gemini-cli/pull/14332) by
  [@galz10](https://github.com/galz10))
- **Enhanced Security:** Security has been a major focus, with default folder
  trust now set to untrusted for increased safety. The Policy Engine has been
  improved to allow specific modes in user and administrator policies, and
  granular allowlisting for shell commands has been implemented, providing finer
  control over tool execution.
  ([#15943](https://github.com/google-gemini/gemini-cli/pull/15943) by
  [@galz10](https://github.com/galz10)),
  ([#15977](https://github.com/google-gemini/gemini-cli/pull/15977) by
  [@NTaylorMullen](https://github.com/NTaylorMullen))
- **Core Functionality:** This release includes a mandatory MessageBus
  injection, marking Phase 3 of a hard migration to a more robust internal
  communication system. We've also added support for built-in skills with the
  CLI itself, and enhanced model routing to effectively utilize subagents.
  ([#15776](https://github.com/google-gemini/gemini-cli/pull/15776) by
  [@abhipatel12](https://githu...
[Truncated]

### ## Announcements: v0.23.0 - 2026-01-07
- 🎉 **Experimental Agent Skills Support in Preview:** Gemini CLI now supports
  [Agent Skills](https://agentskills.io/home) in our preview builds. This is an
  early preview where we’re looking for feedback!
  - Install Preview: `npm install -g @google/gemini-cli@preview`
  - Enable in `/settings`
  - Docs:
    [https://geminicli.com/docs/cli/skills/](https://geminicli.com/docs/cli/skills/)
- **Gemini CLI wrapped:** Run `npx gemini-wrapped` to visualize your usage
  stats, top models, languages, and more!
- **Windows clipboard image support:** Windows users can now paste images
  directly from their clipboard into the CLI using `Alt`+`V`.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/13997) by
  [@sgeraldes](https://github.com/sgeraldes))
- **Terminal background color detection:** Automatically optimizes your
  terminal's background color to select compatible themes and provide
  accessibility warnings.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/15132) by
  [@jacob314](https://github.com/jacob314))
- **Session logout:** Use the new `/logout` command to instantly clear
  credentials and reset your authentication state for seamless account
  switching. ([pr](https://github.com/google-gemini/gemini-cli/pull/13383) by
  [@CN-Scars](https://github.com/CN-Scars))

### ## Announcements: v0.21.0 - 2025-12-15
- **⚡️⚡️⚡️ Gemini 3 Flash + Gemini CLI:** Better, faster and cheaper than 2.5
  Pro - and in some scenarios better than 3 Pro! For paid tiers + free tier
  users who were on the wait list enable **Preview Features** in `/settings.`
- For more information:
  [Gemini 3 Flash is now available in Gemini CLI](https://developers.googleblog.com/gemini-3-flash-is-now-available-in-gemini-cli/).
- 🎉 Gemini CLI Extensions:
  - Rill: Utilize natural language to analyze Rill data, enabling the
    exploration of metrics and trends without the need for manual queries.
    `gemini extensions install https://github.com/rilldata/rill-gemini-extension`
  - Browserbase: Interact with web pages, take screenshots, extract information,
    and perform automated actions with atomic precision.
    `gemini extensions install https://github.com/browserbase/mcp-server-browserbase`
- Quota Visibility: The `/stats` command now displays quota information for all
  available models, including those not used in the current session. (@sehoon38)
- Fuzzy Setting Search: Users can now quickly find settings using fuzzy search
  within the settings dialog. (@sehoon38)
- MCP Resource Support: Users can now discover, view, and search through
  resources using the @ command. (@MrLesk)
- Auto-execute Simple Slash Commands: Simple slash commands are now executed
  immediately on enter. (@jackwotherspoon)

### ## Announcements: v0.19.0 - 2025-11-24
- 🎉 **New extensions:**
  - **Eleven Labs:** Create, play, manage your audio play tracks with the Eleven
    Labs Gemini CLI extension:
    `gemini extensions install https://github.com/elevenlabs/elevenlabs-mcp`
- **Zed integration:** Users can now leverage Gemini 3 within the Zed
  integration after enabling "Preview Features" in their CLI’s `/settings`.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/13398) by
  [@benbrandt](https://github.com/benbrandt))
- **Interactive shell:**
  - **Click-to-Focus:** When "Use Alternate Buffer" setting is enabled, users
    can click within the embedded shell output to focus it for input.
    ([pr](https://github.com/google-gemini/gemini-cli/pull/13341) by
    [@galz10](https://github.com/galz10))
  - **Loading phrase:** Clearly indicates when the interactive shell is awaiting
    user input. ([vid](https://imgur.com/a/kjK8bUK),
    [pr](https://github.com/google-gemini/gemini-cli/pull/12535) by
    [@jackwotherspoon](https://github.com/jackwotherspoon))

### ## Announcements: v0.18.0 - 2025-11-17
- 🎉 **New extensions:**
  - **Google Workspace**: Integrate Gemini CLI with your Workspace data. Write
    docs, build slides, chat with others or even get your calc on in sheets:
    `gemini extensions install https://github.com/gemini-cli-extensions/workspace`
    - Blog:
      [https://allen.hutchison.org/2025/11/19/bringing-the-office-to-the-terminal/](https://allen.hutchison.org/2025/11/19/bringing-the-office-to-the-terminal/)
  - **Redis:** Manage and search data in Redis with natural language:
    `gemini extensions install https://github.com/redis/mcp-redis`
  - **Anomalo:** Query your data warehouse table metadata and quality status
    through commands and natural language:
    `gemini extensions install https://github.com/datagravity-ai/anomalo-gemini-extension`
- **Experimental permission improvements:** We are now experimenting with a new
  policy engine in Gemini CLI. This allows users and administrators to create
  fine-grained policy for tool calls. Currently behind a flag. See
  [policy engine documentation](../reference/policy-engine.md) for more
  information.
  - Blog:
    [https://allen.hutchison.org/2025/11/26/the-guardrails-of-autonomy/](https://allen.hutchison.org/2025/11/26/the-guardrails-of-autonomy/)
- **Gemini 3 support for paid:** Gemini 3 support has been rolled out to all API
  key, Google AI Pro or Google AI Ultra (for individuals, not businesses) and
  Gemini Code Assist Enterprise users. Enable it via `/settings` and toggling on
  **Preview Features**.
- **Updated UI rollback:** We’ve temporarily rolled back our updated UI to give
  it more time to bake. This means for a time you won’t have embedded scrolling
  or mouse support. You can re-enable with `/settings` -> **Use Alternate Screen
  Buffer** -> `true`.
- **Model in history:** Users can now toggle in `/settings` to display model in
  their chat history. ([gif](https://imgur.com/a/uEmNKnQ),
  [pr](https://github.com/google-gemini/gemini-cli/pull/13034) by
  [@scidomino](https:...
[Truncated]

### ## Announcements: v0.15.0 - 2025-11-03
- **🎉 Seamless scrollable UI and mouse support:** We’ve given Gemini CLI a
  major facelift to make your terminal experience smoother and much more
  polished. You now get a flicker-free display with sticky headers that keep
  important context visible and a stable input prompt that doesn't jump around.
  We even added mouse support so you can click right where you need to type!
  ([gif](https://imgur.com/a/O6qc7bx),
  [@jacob314](https://github.com/jacob314)).
  - **Announcement:**
    [https://developers.googleblog.com/en/making-the-terminal-beautiful-one-pixel-at-a-time/](https://developers.googleblog.com/en/making-the-terminal-beautiful-one-pixel-at-a-time/)
- **🎉 New partner extensions:**
  - **Arize:** Seamlessly instrument AI applications with Arize AX and grant
    direct access to Arize support:

    `gemini extensions install https://github.com/Arize-ai/arize-tracing-assistant`

  - **Chronosphere:** Retrieve logs, metrics, traces, events, and specific
    entities:

    `gemini extensions install https://github.com/chronosphereio/chronosphere-mcp`

  - **Transmit:** Comprehensive context, validation, and automated fixes for
    creating production-ready authentication and identity workflows:

    `gemini extensions install https://github.com/TransmitSecurity/transmit-security-journey-builder`

- **Todo planning:** Complex questions now get broken down into todo lists that
  the model can manage and check off. ([gif](https://imgur.com/a/EGDfNlZ),
  [pr](https://github.com/google-gemini/gemini-cli/pull/12905) by
  [@anj-s](https://github.com/anj-s))
- **Disable GitHub extensions:** Users can now prevent the installation and
  loading of extensions from GitHub.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/12838) by
  [@kevinjwang1](https://github.com/kevinjwang1)).
- **Extensions restart:** Users can now explicitly restart extensions using the
  `/extensions restart` command.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/12739) by
  [@...
[Truncated]

### ## Announcements: v0.12.0 - 2025-10-27
![Codebase investigator subagent in Gemini CLI.](https://i.imgur.com/4J1njsx.png)

- **🎉 New partner extensions:**
  - **🤗 Hugging Face extension:** Access the Hugging Face hub.
    ([gif](https://drive.google.com/file/d/1LEzIuSH6_igFXq96_tWev11svBNyPJEB/view?usp=sharing&resourcekey=0-LtPTzR1woh-rxGtfPzjjfg))

    `gemini extensions install https://github.com/huggingface/hf-mcp-server`

  - **Monday.com extension**: Analyze your sprints, update your task boards,
    etc.
    ([gif](https://drive.google.com/file/d/1cO0g6kY1odiBIrZTaqu5ZakaGZaZgpQv/view?usp=sharing&resourcekey=0-xEr67SIjXmAXRe1PKy7Jlw))

    `gemini extensions install https://github.com/mondaycom/mcp`

  - **Data Commons extension:** Query public datasets or ground responses on
    data from Data Commons
    ([gif](https://drive.google.com/file/d/1cuj-B-vmUkeJnoBXrO_Y1CuqphYc6p-O/view?usp=sharing&resourcekey=0-0adXCXDQEd91ZZW63HbW-Q)).

    `gemini extensions install https://github.com/gemini-cli-extensions/datacommons`

- **Model selection:** Choose the Gemini model for your session with `/model`.
  ([pic](https://imgur.com/a/ABFcWWw),
  [pr](https://github.com/google-gemini/gemini-cli/pull/8940) by
  [@abhipatel12](https://github.com/abhipatel12)).
- **Model routing:** Gemini CLI will now intelligently pick the best model for
  the task. Simple queries will be sent to Flash while complex analytical or
  creative tasks will still use the power of Pro. This ensures your quota will
  last for a longer period of time. You can always opt-out of this via `/model`.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/9262) by
  [@abhipatel12](https://github.com/abhipatel12)).
  - Discussion:
    [https://github.com/google-gemini/gemini-cli/discussions/12375](https://github.com/google-gemini/gemini-cli/discussions/12375)
- **Codebase investigator subagent:** We now have a new built-in subagent that
  will explore your workspace and resolve relevant information to improve
  overall performance.
  ([pr](h...
[Truncated]

### ## Announcements: v0.11.0 - 2025-10-20
![Gemini CLI and Jules](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Jules_Extension_-_Blog_Header_O346JNt.original.png)

- 🎉 **Gemini CLI Jules Extension:** Use Gemini CLI to orchestrate Jules. Spawn
  remote workers, delegate tedious tasks, or check in on running jobs!
  - Install:
    `gemini extensions install https://github.com/gemini-cli-extensions/jules`
  - Announcement:
    [https://developers.googleblog.com/en/introducing-the-jules-extension-for-gemini-cli/](https://developers.googleblog.com/en/introducing-the-jules-extension-for-gemini-cli/)
- **Stream JSON output:** Stream real-time JSONL events with
  `--output-format stream-json` to monitor AI agent progress when run
  headlessly. ([gif](https://imgur.com/a/0UCE81X),
  [pr](https://github.com/google-gemini/gemini-cli/pull/10883) by
  [@anj-s](https://github.com/anj-s))
- **Markdown toggle:** Users can now switch between rendered and raw markdown
  display using `alt+m `or` ctrl+m`. ([gif](https://imgur.com/a/lDNdLqr),
  [pr](https://github.com/google-gemini/gemini-cli/pull/10383) by
  [@srivatsj](https://github.com/srivatsj))
- **Queued message editing:** Users can now quickly edit queued messages by
  pressing the up arrow key when the input is empty.
  ([gif](https://imgur.com/a/ioRslLd),
  [pr](https://github.com/google-gemini/gemini-cli/pull/10392) by
  [@akhil29](https://github.com/akhil29))
- **JSON web fetch**: Non-HTML content like JSON APIs or raw source code are now
  properly shown to the model (previously only supported HTML)
  ([gif](https://imgur.com/a/Q58U4qJ),
  [pr](https://github.com/google-gemini/gemini-cli/pull/11284) by
  [@abhipatel12](https://github.com/abhipatel12))
- **Non-interactive MCP commands:** Users can now run MCP slash commands in
  non-interactive mode `gemini "/some-mcp-prompt"`.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/10194) by
  [@capachino](https://github.com/capachino))
- **Removal of deprecated flags:** We’ve finally rem...
[Truncated]

### ## Announcements: v0.6.0 - 2025-09-15
- 🎉 **Higher limits for Google AI Pro and Ultra subscribers:** We’re psyched to
  finally announce that Google AI Pro and AI Ultra subscribers now get access to
  significantly higher 2.5 quota limits for Gemini CLI!
  - **Announcement:**
    [https://blog.google/technology/developers/gemini-cli-code-assist-higher-limits/](https://blog.google/technology/developers/gemini-cli-code-assist-higher-limits/)
- 🎉**Gemini CLI Databases and BigQuery Extensions:** Connect Gemini CLI to all
  of your cloud data with Gemini CLI.
  - Announcement and how to get started with each of the below extensions:
    [https://cloud.google.com/blog/products/databases/gemini-cli-extensions-for-google-data-cloud?e=48754805](https://cloud.google.com/blog/products/databases/gemini-cli-extensions-for-google-data-cloud?e=48754805)
  - **AlloyDB:** Interact, manage and observe AlloyDB for PostgreSQL databases
    ([manage](https://github.com/gemini-cli-extensions/alloydb#configuration),
    [observe](https://github.com/gemini-cli-extensions/alloydb-observability#configuration))
  - **BigQuery:** Connect and query your BigQuery datasets or utilize a
    sub-agent for contextual insights
    ([query](https://github.com/gemini-cli-extensions/bigquery-data-analytics#configuration),
    [sub-agent](https://github.com/gemini-cli-extensions/bigquery-conversational-analytics))
  - **Cloud SQL:** Interact, manage and observe Cloud SQL for PostgreSQL
    ([manage](https://github.com/gemini-cli-extensions/cloud-sql-postgresql#configuration),[ observe](https://github.com/gemini-cli-extensions/cloud-sql-postgresql-observability#configuration)),
    Cloud SQL for MySQL
    ([manage](https://github.com/gemini-cli-extensions/cloud-sql-mysql#configuration),[ observe](https://github.com/gemini-cli-extensions/cloud-sql-mysql-observability#configuration))
    and Cloud SQL for SQL Server
    ([manage](https://github.com/gemini-cli-extensions/cloud-sql-sqlserver#configuration),[ observe](https://github.com/gemini-cli...
[Truncated]

### ## Announcements: v0.5.0 - 2025-09-08
- 🎉**FastMCP + Gemini CLI**🎉: Quickly install and manage your Gemini CLI MCP
  servers with FastMCP ([video](https://imgur.com/a/m8QdCPh),
  [pr](https://github.com/jlowin/fastmcp/pull/1709) by
  [@jackwotherspoon](https://github.com/jackwotherspoon)**)**
  - Getting started:
    [https://gofastmcp.com/integrations/gemini-cli](https://gofastmcp.com/integrations/gemini-cli)
- **Positional Prompt for Non-Interactive:** Seamlessly invoke Gemini CLI
  headlessly via `gemini "Hello"`. Synonymous with passing `-p`.
  ([gif](https://imgur.com/a/hcBznpB),
  [pr](https://github.com/google-gemini/gemini-cli/pull/7668) by
  [@allenhutchison](https://github.com/allenhutchison))
- **Experimental Tool output truncation:** Enable truncating shell tool outputs
  and saving full output to a file by setting
  `"enableToolOutputTruncation": true `([pr](https://github.com/google-gemini/gemini-cli/pull/8039)
  by [@SandyTao520](https://github.com/SandyTao520))
- **Edit Tool improvements:** Gemini CLI’s ability to edit files should now be
  far more capable. ([pr](https://github.com/google-gemini/gemini-cli/pull/7679)
  by [@silviojr](https://github.com/silviojr))
- **Custom witty messages:** The feature you’ve all been waiting for…
  Personalized witty loading messages via
  `"ui": { "customWittyPhrases": ["YOLO"]}` in `settings.json`.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/7641) by
  [@JayadityaGit](https://github.com/JayadityaGit))
- **Nested .gitignore File Handling:** Nested `.gitignore` files are now
  respected. ([pr](https://github.com/google-gemini/gemini-cli/pull/7645) by
  [@gsquared94](https://github.com/gsquared94))
- **Enforced authentication:** System administrators can now mandate a specific
  authentication method via
  `"enforcedAuthType": "oauth-personal|gemini-api-key|…"`in `settings.json`.
  ([pr](https://github.com/google-gemini/gemini-cli/pull/6564) by
  [@chrstnb](https://github.com/chrstnb))
- **A2A development-tool extension:** An RFC for an Ag...
[Truncated]

### ## Announcements: v0.4.0 - 2025-09-01
- 🎉**Gemini CLI CloudRun and Security Integrations**🎉: Automate app deployment
  and security analysis with CloudRun and Security extension integrations. Once
  installed deploy your app to the cloud with `/deploy` and find and fix
  security vulnerabilities with `/security:analyze`.
  - Announcement and how to get started:
    [https://cloud.google.com/blog/products/ai-machine-learning/automate-app-deployment-and-security-analysis-with-new-gemini-cli-extensions](https://cloud.google.com/blog/products/ai-machine-learning/automate-app-deployment-and-security-analysis-with-new-gemini-cli-extensions)
- **Experimental**
  - **Edit Tool:** Give our new edit tool a try by setting
    `"useSmartEdit": true` in `settings.json`!
    ([feedback](https://github.com/google-gemini/gemini-cli/discussions/7758),
    [pr](https://github.com/google-gemini/gemini-cli/pull/6823) by
    [@silviojr](https://github.com/silviojr))
  - **Model talking to itself fix:** We’ve removed a model workaround that would
    encourage Gemini CLI to continue conversations on your behalf. This may be
    disruptive and can be disabled via `"skipNextSpeakerCheck": false` in your
    `settings.json`
    ([feedback](https://github.com/google-gemini/gemini-cli/discussions/6666),
    [pr](https://github.com/google-gemini/gemini-cli/pull/7614) by
    [@SandyTao520](https://github.com/SandyTao520))
  - **Prompt completion:** Get real-time AI suggestions to complete your prompts
    as you type. Enable it with `"general": { "enablePromptCompletion": true }`
    and share your feedback!
    ([gif](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*hvegW7YXOg6N_beUWhTdxA.gif),
    [pr](https://github.com/google-gemini/gemini-cli/pull/4691) by
    [@3ks](https://github.com/3ks))
- **Footer visibility configuration:** Customize the CLI's footer look and feel
  in `settings.json`
  ([pr](https://github.com/google-gemini/gemini-cli/pull/7419) by
  [@miguelsolorio](https://github.com/miguelsolorio))
  - `hideC...
[Truncated]

### ## Highlights
- **Plan Mode:** Introduce a dedicated "Plan Mode" to help you architect complex
  changes before implementation. Use `/plan` to get started.
- **Gemini 3 by Default:** Gemini 3 is now the default model family, bringing
  improved performance and reasoning capabilities to all users without needing a
  feature flag.
- **Extension Discovery:** Easily discover and install extensions with the new
  exploration features and registry client.
- **Enhanced Admin Controls:** New administrative capabilities allow for
  allowlisting MCP server configurations, giving organizations more control over
  available tools.
- **Sub-agent Improvements:** Sub-agents have been transitioned to a new format
  with improved definitions and system prompts for better reliability.

### ## What's Changed
- fix: remove `ask_user` tool from non-interactive modes by @jackwotherspoon in
  [#18154](https://github.com/google-gemini/gemini-cli/pull/18154)
- fix(cli): allow restricted .env loading in untrusted sandboxed folders by
  @galz10 in [#17806](https://github.com/google-gemini/gemini-cli/pull/17806)
- Encourage agent to utilize ecosystem tools to perform work by @gundermanc in
  [#17881](https://github.com/google-gemini/gemini-cli/pull/17881)
- feat(plan): unify workflow location in system prompt to optimize caching by
  @jerop in [#18258](https://github.com/google-gemini/gemini-cli/pull/18258)
- feat(core): enable getUserTierName in config by @sehoon38 in
  [#18265](https://github.com/google-gemini/gemini-cli/pull/18265)
- feat(core): add default execution limits for subagents by @abhipatel12 in
  [#18274](https://github.com/google-gemini/gemini-cli/pull/18274)
- Fix issue where agent gets stuck at interactive commands. by @gundermanc in
  [#18272](https://github.com/google-gemini/gemini-cli/pull/18272)
- chore(release): bump version to 0.29.0-nightly.20260203.71f46f116 by
  @gemini-cli-robot in
  [#18243](https://github.com/google-gemini/gemini-cli/pull/18243)
- feat(core): remove hardcoded policy bypass for local subagents by @abhipatel12
  in [#18153](https://github.com/google-gemini/gemini-cli/pull/18153)
- feat(plan): implement `plan` slash command by @Adib234 in
  [#17698](https://github.com/google-gemini/gemini-cli/pull/17698)
- feat: increase `ask_user` label limit to 16 characters by @jackwotherspoon in
  [#18320](https://github.com/google-gemini/gemini-cli/pull/18320)
- Add information about the agent skills lifecycle and clarify docs-writer skill
  metadata. by @g-samroberts in
  [#18234](https://github.com/google-gemini/gemini-cli/pull/18234)
- feat(core): add `enter_plan_mode` tool by @jerop in
  [#18324](https://github.com/google-gemini/gemini-cli/pull/18324)
- Stop showing an error message in `/plan` by @Adib234 in
  [#18333](https://github.com/googl...
[Truncated]

### ## Highlights
- **Initial SDK Package:** Introduced the initial SDK package with support for
  custom skills and dynamic system instructions.
- **Refined Plan Mode:** Refined Plan Mode with support for enabling skills,
  improved agentic execution, and project exploration without planning.
- **Enhanced CLI UI:** Enhanced CLI UI with a new clean UI toggle, minimal-mode
  bleed-through, and support for Ctrl-Z suspension.
- **`--policy` flag:** Added the `--policy` flag to support user-defined
  policies.
- **New Themes:** Added Solarized Dark and Solarized Light themes.

### ## What's Changed
- fix(patch): cherry-pick 261788c to release/v0.30.0-preview.0-pr-19453 to patch
  version v0.30.0-preview.0 and create version 0.30.0-preview.1 by
  @gemini-cli-robot in
  [#19490](https://github.com/google-gemini/gemini-cli/pull/19490)
- feat(ux): added text wrapping capabilities to markdown tables by @devr0306 in
  [#18240](https://github.com/google-gemini/gemini-cli/pull/18240)
- Revert "fix(mcp): ensure MCP transport is closed to prevent memory leaks" by
  @skeshive in [#18771](https://github.com/google-gemini/gemini-cli/pull/18771)
- chore(release): bump version to 0.30.0-nightly.20260210.a2174751d by
  @gemini-cli-robot in
  [#18772](https://github.com/google-gemini/gemini-cli/pull/18772)
- chore: cleanup unused and add unlisted dependencies in packages/core by
  @adamfweidman in
  [#18762](https://github.com/google-gemini/gemini-cli/pull/18762)
- chore(core): update activate_skill prompt verbiage to be more direct by
  @NTaylorMullen in
  [#18605](https://github.com/google-gemini/gemini-cli/pull/18605)
- Add autoconfigure memory usage setting to the dialog by @jacob314 in
  [#18510](https://github.com/google-gemini/gemini-cli/pull/18510)
- fix(core): prevent race condition in policy persistence by @braddux in
  [#18506](https://github.com/google-gemini/gemini-cli/pull/18506)
- fix(evals): prevent false positive in hierarchical memory test by
  @Abhijit-2592 in
  [#18777](https://github.com/google-gemini/gemini-cli/pull/18777)
- test(evals): mark all `save_memory` evals as `USUALLY_PASSES` due to
  unreliability by @jerop in
  [#18786](https://github.com/google-gemini/gemini-cli/pull/18786)
- feat(cli): add setting to hide shortcuts hint UI by @LyalinDotCom in
  [#18562](https://github.com/google-gemini/gemini-cli/pull/18562)
- feat(core): formalize 5-phase sequential planning workflow by @jerop in
  [#18759](https://github.com/google-gemini/gemini-cli/pull/18759)
- Introduce limits for search results. by @gundermanc in
  [#18767](https://github.com/google-ge...
[Truncated]

### ## CLI commands
| Command                            | Description                        | Example                                             |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------- |
| `gemini`                           | Start interactive REPL             | `gemini`                                            |
| `gemini "query"`                   | Query non-interactively, then exit | `gemini "explain this project"`                     |
| `cat file \| gemini`               | Process piped content              | `cat logs.txt \| gemini`                            |
| `gemini -i "query"`                | Execute and continue interactively | `gemini -i "What is the purpose of this project?"`  |
| `gemini -r "latest"`               | Continue most recent session       | `gemini -r "latest"`                                |
| `gemini -r "latest" "query"`       | Continue session with a new prompt | `gemini -r "latest" "Check for type errors"`        |
| `gemini -r "<session-id>" "query"` | Resume session by ID               | `gemini -r "abc123" "Finish this PR"`               |
| `gemini update`                    | Update to latest version           | `gemini update`                                     |
| `gemini extensions`                | Manage extensions                  | See [Extensions Management](#extensions-management) |
| `gemini mcp`                       | Configure MCP servers              | See [MCP Server Management](#mcp-server-management) |

### ## CLI Options
| Option                           | Alias | Type    | Default   | Description                                                                                                                                                            |
| -------------------------------- | ----- | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--debug`                        | `-d`  | boolean | `false`   | Run in debug mode with verbose logging                                                                                                                                 |
| `--version`                      | `-v`  | -       | -         | Show CLI version number and exit                                                                                                                                       |
| `--help`                         | `-h`  | -       | -         | Show help information                                                                                                                                                  |
| `--model`                        | `-m`  | string  | `auto`    | Model to use. See [Model Selection](#model-selection) for available values.                                                                                            |
| `--prompt`                       | `-p`  | string  | -         | Prompt text. Appended to stdin input if provided. **Deprecated:** Use positional arguments instead.                                                                    |
| `--prompt-interactive`           | `-i`  | string  | -         | Execute prompt and continue in interactive mode                                                                                                                        |
| `--sandbox`                      | `-s`  | boolean | `false`   | Run in a sandboxed environment for safer exec...
[Truncated]

### ## Extensions management
| Command                                            | Description                                  | Example                                                                        |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `gemini extensions install <source>`               | Install extension from Git URL or local path | `gemini extensions install https://github.com/user/my-extension`               |
| `gemini extensions install <source> --ref <ref>`   | Install from specific branch/tag/commit      | `gemini extensions install https://github.com/user/my-extension --ref develop` |
| `gemini extensions install <source> --auto-update` | Install with auto-update enabled             | `gemini extensions install https://github.com/user/my-extension --auto-update` |
| `gemini extensions uninstall <name>`               | Uninstall one or more extensions             | `gemini extensions uninstall my-extension`                                     |
| `gemini extensions list`                           | List all installed extensions                | `gemini extensions list`                                                       |
| `gemini extensions update <name>`                  | Update a specific extension                  | `gemini extensions update my-extension`                                        |
| `gemini extensions update --all`                   | Update all extensions                        | `gemini extensions update --all`                                               |
| `gemini extensions enable <name>`                  | Enable an extension                          | `gemini extensions enable my-extension`                                        |
| `gemini extensions disable <name>`                 | Disable an extension                         | `gemini extensions disable my-extension`                            ...
[Truncated]

### ## MCP server management
| Command                                                       | Description                     | Example                                                                                              |
| ------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `gemini mcp add <name> <command>`                             | Add stdio-based MCP server      | `gemini mcp add github npx -y @modelcontextprotocol/server-github`                                   |
| `gemini mcp add <name> <url> --transport http`                | Add HTTP-based MCP server       | `gemini mcp add api-server http://localhost:3000 --transport http`                                   |
| `gemini mcp add <name> <command> --env KEY=value`             | Add with environment variables  | `gemini mcp add slack node server.js --env SLACK_TOKEN=xoxb-xxx`                                     |
| `gemini mcp add <name> <command> --scope user`                | Add with user scope             | `gemini mcp add db node db-server.js --scope user`                                                   |
| `gemini mcp add <name> <command> --include-tools tool1,tool2` | Add with specific tools         | `gemini mcp add github npx -y @modelcontextprotocol/server-github --include-tools list_repos,get_pr` |
| `gemini mcp remove <name>`                                    | Remove an MCP server            | `gemini mcp remove github`                                                                           |
| `gemini mcp list`                                             | List all configured MCP servers | `gemini mcp list`                                                                                    |

See [MCP Server Integration](../tools/mcp-server.md) for more details.

### ## Skills management
| Command                          | Description                           | Example                                           |
| -------------------------------- | ------------------------------------- | ------------------------------------------------- |
| `gemini skills list`             | List all discovered agent skills      | `gemini skills list`                              |
| `gemini skills install <source>` | Install skill from Git, path, or file | `gemini skills install https://github.com/u/repo` |
| `gemini skills link <path>`      | Link local agent skills via symlink   | `gemini skills link /path/to/my-skills`           |
| `gemini skills uninstall <name>` | Uninstall an agent skill              | `gemini skills uninstall my-skill`                |
| `gemini skills enable <name>`    | Enable an agent skill                 | `gemini skills enable my-skill`                   |
| `gemini skills disable <name>`   | Disable an agent skill                | `gemini skills disable my-skill`                  |
| `gemini skills enable --all`     | Enable all skills                     | `gemini skills enable --all`                      |
| `gemini skills disable --all`    | Disable all skills                    | `gemini skills disable --all`                     |

See [Agent Skills Documentation](./skills.md) for more details.

### # Creating Agent Skills
This guide provides an overview of how to create your own Agent Skills to extend
the capabilities of Gemini CLI.

### ## Getting started: The `skill-creator` skill
The recommended way to create a new skill is to use the built-in `skill-creator`
skill. To use it, ask Gemini CLI to create a new skill for you.

**Example prompt:**

> "create a new skill called 'code-reviewer'"

Gemini CLI will then use the `skill-creator` to generate the skill:

1.  Generate a new directory for your skill (e.g., `my-new-skill/`).
2.  Create a `SKILL.md` file with the necessary YAML frontmatter (`name` and
    `description`).
3.  Create the standard resource directories: `scripts/`, `references/`, and
    `assets/`.

### ## Manual skill creation
If you prefer to create skills manually:

1.  **Create a directory** for your skill (e.g., `my-new-skill/`).
2.  **Create a `SKILL.md` file** inside the new directory.

To add additional resources that support the skill, refer to the skill
structure.

### ## Skill structure
A skill is a directory containing a `SKILL.md` file at its root.

### ### Folder structure
While a `SKILL.md` file is the only required component, we recommend the
following structure for organizing your skill's resources:

```text
my-skill/
├── SKILL.md       (Required) Instructions and metadata
├── scripts/       (Optional) Executable scripts
├── references/    (Optional) Static documentation
└── assets/        (Optional) Templates and other resources
```

### ### `SKILL.md` file
The `SKILL.md` file is the core of your skill. This file uses YAML frontmatter
for metadata and Markdown for instructions. For example:

```markdown
---
name: code-reviewer
description:
  Use this skill to review code. It supports both local changes and remote Pull
  Requests.
---

### # Code Reviewer
This skill guides the agent in conducting thorough code reviews.

### ### 1. Determine Review Target
- **Remote PR**: If the user gives a PR number or URL, target that remote PR.
- **Local Changes**: If changes are local... ...
```

- **`name`**: A unique identifier for the skill. This should match the directory
  name.
- **`description`**: A description of what the skill does and when Gemini should
  use it.
- **Body**: The Markdown body of the file contains the instructions that guide
  the agent's behavior when the skill is active.

### ## Centralized configuration: The system settings file
The most powerful tools for enterprise administration are the system-wide
settings files. These files allow you to define a baseline configuration
(`system-defaults.json`) and a set of overrides (`settings.json`) that apply to
all users on a machine. For a complete overview of configuration options, see
the [Configuration documentation](../reference/configuration.md).

Settings are merged from four files. The precedence order for single-value
settings (like `theme`) is:

1. System Defaults (`system-defaults.json`)
2. User Settings (`~/.gemini/settings.json`)
3. Workspace Settings (`<project>/.gemini/settings.json`)
4. System Overrides (`settings.json`)

This means the System Overrides file has the final say. For settings that are
arrays (`includeDirectories`) or objects (`mcpServers`), the values are merged.

**Example of merging and precedence:**

Here is how settings from different levels are combined.

- **System defaults `system-defaults.json`:**

  ```json
  {
    "ui": {
      "theme": "default-corporate-theme"
    },
    "context": {
      "includeDirectories": ["/etc/gemini-cli/common-context"]
    }
  }
  ```

- **User `settings.json` (`~/.gemini/settings.json`):**

  ```json
  {
    "ui": {
      "theme": "user-preferred-dark-theme"
    },
    "mcpServers": {
      "corp-server": {
        "command": "/usr/local/bin/corp-server-dev"
      },
      "user-tool": {
        "command": "npm start --prefix ~/tools/my-tool"
      }
    },
    "context": {
      "includeDirectories": ["~/gemini-context"]
    }
  }
  ```

- **Workspace `settings.json` (`<project>/.gemini/settings.json`):**

  ```json
  {
    "ui": {
      "theme": "project-specific-light-theme"
    },
    "mcpServers": {
      "project-tool": {
        "command": "npm start"
      }
    },
    "context": {
      "includeDirectories": ["./project-context"]
    }
  }
  ```

- **System overrides `settings.json`:**
  ```json
  {
    "ui": {
      "theme": "system-enforced-theme"
    },
    "mcpServers"...
[Truncated]

### ## Managing custom tools (MCP servers)
If your organization uses custom tools via
[Model-Context Protocol (MCP) servers](../reference/tools-api.md), it is crucial
to understand how server configurations are managed to apply security policies
effectively.

### ### How MCP server configurations are merged
Gemini CLI loads `settings.json` files from three levels: System, Workspace, and
User. When it comes to the `mcpServers` object, these configurations are
**merged**:

1.  **Merging:** The lists of servers from all three levels are combined into a
    single list.
2.  **Precedence:** If a server with the **same name** is defined at multiple
    levels (e.g., a server named `corp-api` exists in both system and user
    settings), the definition from the highest-precedence level is used. The
    order of precedence is: **System > Workspace > User**.

This means a user **cannot** override the definition of a server that is already
defined in the system-level settings. However, they **can** add new servers with
unique names.

### ### Enforcing a catalog of tools
The security of your MCP tool ecosystem depends on a combination of defining the
canonical servers and adding their names to an allowlist.

### ### Restricting tools within an MCP server
For even greater security, especially when dealing with third-party MCP servers,
you can restrict which specific tools from a server are exposed to the model.
This is done using the `includeTools` and `excludeTools` properties within a
server's definition. This allows you to use a subset of tools from a server
without allowing potentially dangerous ones.

Following the principle of least privilege, it is highly recommended to use
`includeTools` to create an allowlist of only the necessary tools.

**Example:** Only allow the `code-search` and `get-ticket-details` tools from a
third-party MCP server, even if the server offers other tools like
`delete-ticket`.

```json
{
  "mcp": {
    "allowed": ["third-party-analyzer"]
  },
  "mcpServers": {
    "third-party-analyzer": {
      "command": "/usr/local/bin/start-3p-analyzer.sh",
      "includeTools": ["code-search", "get-ticket-details"]
    }
  }
}
```

### #### More secure pattern: Define and add to allowlist in system settings
To create a secure, centrally-managed catalog of tools, the system administrator
**must** do both of the following in the system-level `settings.json` file:

1.  **Define the full configuration** for every approved server in the
    `mcpServers` object. This ensures that even if a user defines a server with
    the same name, the secure system-level definition will take precedence.
2.  **Add the names** of those servers to an allowlist using the `mcp.allowed`
    setting. This is a critical security step that prevents users from running
    any servers that are not on this list. If this setting is omitted, the CLI
    will merge and allow any server defined by the user.

**Example system `settings.json`:**

1. Add the _names_ of all approved servers to an allowlist. This will prevent
   users from adding their own servers.

2. Provide the canonical _definition_ for each server on the allowlist.

```json
{
  "mcp": {
    "allowed": ["corp-data-api", "source-code-analyzer"]
  },
  "mcpServers": {
    "corp-data-api": {
      "command": "/usr/local/bin/start-corp-api.sh",
      "timeout": 5000
    },
    "source-code-analyzer": {
      "command": "/usr/local/bin/start-analyzer.sh"
    }
  }
}
```

This pattern is more secure because it uses both definition and an allowlist.
Any server a user defines will either be overridden by the system definition (if
it has the same name) or blocked because its name is not in the `mcp.allowed`
list.

### ### Less secure pattern: Omitting the allowlist
If the administrator defines the `mcpServers` object but fails to also specify
the `mcp.allowed` allowlist, users may add their own servers.

**Example system `settings.json`:**

This configuration defines servers but does not enforce the allowlist. The
administrator has NOT included the "mcp.allowed" setting.

```json
{
  "mcpServers": {
    "corp-data-api": {
      "command": "/usr/local/bin/start-corp-api.sh"
    }
  }
}
```

In this scenario, a user can add their own server in their local
`settings.json`. Because there is no `mcp.allowed` list to filter the merged
results, the user's server will be added to the list of available tools and
allowed to run.

### ## Controlling network access via proxy
In corporate environments with strict network policies, you can configure Gemini
CLI to route all outbound traffic through a corporate proxy. This can be set via
an environment variable, but it can also be enforced for custom tools via the
`mcpServers` configuration.

**Example (for an MCP server):**

```json
{
  "mcpServers": {
    "proxied-server": {
      "command": "node",
      "args": ["mcp_server.js"],
      "env": {
        "HTTP_PROXY": "http://proxy.example.com:8080",
        "HTTPS_PROXY": "http://proxy.example.com:8080"
      }
    }
  }
}
```

### ## Putting it all together: example system `settings.json`
Here is an example of a system `settings.json` file that combines several of the
patterns discussed above to create a secure, controlled environment for Gemini
CLI.

```json
{
  "tools": {
    "sandbox": "docker",
    "core": [
      "ReadFileTool",
      "GlobTool",
      "ShellTool(ls)",
      "ShellTool(cat)",
      "ShellTool(grep)"
    ]
  },
  "mcp": {
    "allowed": ["corp-tools"]
  },
  "mcpServers": {
    "corp-tools": {
      "command": "/opt/gemini-tools/start.sh",
      "timeout": 5000
    }
  },
  "telemetry": {
    "enabled": true,
    "target": "gcp",
    "otlpEndpoint": "https://telemetry-prod.example.com:4317",
    "logPrompts": false
  },
  "advanced": {
    "bugCommand": {
      "urlTemplate": "https://servicedesk.example.com/new-ticket?title={title}&details={info}"
    }
  },
  "privacy": {
    "usageStatisticsEnabled": false
  }
}
```

This configuration:

- Forces all tool execution into a Docker sandbox.
- Strictly uses an allowlist for a small set of safe shell commands and file
  tools.
- Defines and allows a single corporate MCP server for custom tools.
- Enables telemetry for auditing, without logging prompt content.
- Redirects the `/bug` command to an internal ticketing system.
- Disables general usage statistics collection.

### # Plan Mode (experimental)
Plan Mode is a safe, read-only mode for researching and designing complex
changes. It prevents modifications while you research, design and plan an
implementation strategy.

> **Note: Plan Mode is currently an experimental feature.**
>
> Experimental features are subject to change. To use Plan Mode, enable it via
> `/settings` (search for `Plan`) or add the following to your `settings.json`:
>
> ```json
> {
>   "experimental": {
>     "plan": true
>   }
> }
> ```
>
> Your feedback is invaluable as we refine this feature. If you have ideas,
> suggestions, or encounter issues:
>
> - Use the `/bug` command within the CLI to file an issue.
> - [Open an issue](https://github.com/google-gemini/gemini-cli/issues) on
>   GitHub.

- [Starting in Plan Mode](#starting-in-plan-mode)
- [How to use Plan Mode](#how-to-use-plan-mode)
  - [Entering Plan Mode](#entering-plan-mode)
  - [The Planning Workflow](#the-planning-workflow)
  - [Exiting Plan Mode](#exiting-plan-mode)
- [Tool Restrictions](#tool-restrictions)
  - [Customizing Planning with Skills](#customizing-planning-with-skills)
  - [Customizing Policies](#customizing-policies)

### ## Tool Restrictions
Plan Mode enforces strict safety policies to prevent accidental changes.

These are the only allowed tools:

- **FileSystem (Read):** [`read_file`], [`list_directory`], [`glob`]
- **Search:** [`grep_search`], [`google_web_search`]
- **Interaction:** [`ask_user`]
- **MCP Tools (Read):** Read-only [MCP tools] (e.g., `github_read_issue`,
  `postgres_read_schema`) are allowed.
- **Planning (Write):** [`write_file`] and [`replace`] ONLY allowed for `.md`
  files in the `~/.gemini/tmp/<project>/<session-id>/plans/` directory.
- **Skills:** [`activate_skill`] (allows loading specialized instructions and
  resources in a read-only manner)

### ### Customizing Planning with Skills
You can leverage [Agent Skills](./skills.md) to customize how Gemini CLI
approaches planning for specific types of tasks. When a skill is activated
during Plan Mode, its specialized instructions and procedural workflows will
guide the research and design phases.

For example:

- A **"Database Migration"** skill could ensure the plan includes data safety
  checks and rollback strategies.
- A **"Security Audit"** skill could prompt the agent to look for specific
  vulnerabilities during codebase exploration.
- A **"Frontend Design"** skill could guide the agent to use specific UI
  components and accessibility standards in its proposal.

To use a skill in Plan Mode, you can explicitly ask the agent to "use the
[skill-name] skill to plan..." or the agent may autonomously activate it based
on the task description.

### #### Example: Enable research sub-agents in Plan Mode
You can enable [experimental research sub-agents] like `codebase_investigator`
to help gather architecture details during the planning phase.

`~/.gemini/policies/research-subagents.toml`

```toml
[[rule]]
toolName = "codebase_investigator"
decision = "allow"
priority = 100
modes = ["plan"]
```

Tell the agent it can use these tools in your prompt, for example: _"You can
check ongoing changes in git."_

For more information on how the policy engine works, see the [Policy Engine
Guide].

[`list_directory`]: /docs/tools/file-system.md#1-list_directory-readfolder
[`read_file`]: /docs/tools/file-system.md#2-read_file-readfile
[`grep_search`]: /docs/tools/file-system.md#5-grep_search-searchtext
[`write_file`]: /docs/tools/file-system.md#3-write_file-writefile
[`glob`]: /docs/tools/file-system.md#4-glob-findfiles
[`google_web_search`]: /docs/tools/web-search.md
[`replace`]: /docs/tools/file-system.md#6-replace-edit
[MCP tools]: /docs/tools/mcp-server.md
[`activate_skill`]: /docs/cli/skills.md
[experimental research sub-agents]: /docs/core/subagents.md
[Policy Engine Guide]: /docs/reference/policy-engine.md
[`enter_plan_mode`]: /docs/tools/planning.md#1-enter_plan_mode-enterplanmode
[`exit_plan_mode`]: /docs/tools/planning.md#2-exit_plan_mode-exitplanmode
[`ask_user`]: /docs/tools/ask-user.md

### ### UI
| UI Label                             | Setting                                | Description                                                                                                                                                       | Default  |
| ------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Auto Theme Switching                 | `ui.autoThemeSwitching`                | Automatically switch between default light and dark themes based on terminal background color.                                                                    | `true`   |
| Terminal Background Polling Interval | `ui.terminalBackgroundPollingInterval` | Interval in seconds to poll the terminal background color.                                                                                                        | `60`     |
| Hide Window Title                    | `ui.hideWindowTitle`                   | Hide the window title bar                                                                                                                                         | `false`  |
| Inline Thinking                      | `ui.inlineThinkingMode`                | Display model thinking inline: off or full.                                                                                                                       | `"off"`  |
| Show Thoughts in Title               | `ui.showStatusInTitle`                 | Show Gemini CLI model thoughts in the terminal window title during the working phase                                                                              | `false`  |
| Dynamic Window Title                 | `ui.dynamicWindowTitle`                | Update the terminal window title with current status icons (Ready: ◇, Action Required: ✋, Working: ✦)                  ...
[Truncated]

### ### Skills
| UI Label            | Setting          | Description          | Default |
| ------------------- | ---------------- | -------------------- | ------- |
| Enable Agent Skills | `skills.enabled` | Enable Agent Skills. | `true`  |

### # Agent Skills
Agent Skills allow you to extend Gemini CLI with specialized expertise,
procedural workflows, and task-specific resources. Based on the
[Agent Skills](https://agentskills.io) open standard, a "skill" is a
self-contained directory that packages instructions and assets into a
discoverable capability.

### ## Overview
Unlike general context files ([`GEMINI.md`](./gemini-md.md)), which provide
persistent workspace-wide background, Skills represent **on-demand expertise**.
This allows Gemini to maintain a vast library of specialized capabilities—such
as security auditing, cloud deployments, or codebase migrations—without
cluttering the model's immediate context window.

Gemini autonomously decides when to employ a skill based on your request and the
skill's description. When a relevant skill is identified, the model "pulls in"
the full instructions and resources required to complete the task using the
`activate_skill` tool.

### ## Key Benefits
- **Shared Expertise:** Package complex workflows (like a specific team's PR
  review process) into a folder that anyone can use.
- **Repeatable Workflows:** Ensure complex multi-step tasks are performed
  consistently by providing a procedural framework.
- **Resource Bundling:** Include scripts, templates, or example data alongside
  instructions so the agent has everything it needs.
- **Progressive Disclosure:** Only skill metadata (name and description) is
  loaded initially. Detailed instructions and resources are only disclosed when
  the model explicitly activates the skill, saving context tokens.

### ## Skill Discovery Tiers
Gemini CLI discovers skills from three primary locations:

1.  **Workspace Skills**: Located in `.gemini/skills/` or the `.agents/skills/`
    alias. Workspace skills are typically committed to version control and
    shared with the team.
2.  **User Skills**: Located in `~/.gemini/skills/` or the `~/.agents/skills/`
    alias. These are personal skills available across all your workspaces.
3.  **Extension Skills**: Skills bundled within installed
    [extensions](../extensions/index.md).

**Precedence:** If multiple skills share the same name, higher-precedence
locations override lower ones: **Workspace > User > Extension**.

Within the same tier (user or workspace), the `.agents/skills/` alias takes
precedence over the `.gemini/skills/` directory. This generic alias provides an
intuitive path for managing agent-specific expertise that remains compatible
across different AI agent tools.

### ## Managing Skills


### ### In an Interactive Session
Use the `/skills` slash command to view and manage available expertise:

- `/skills list` (default): Shows all discovered skills and their status.
- `/skills link <path>`: Links agent skills from a local directory via symlink.
- `/skills disable <name>`: Prevents a specific skill from being used.
- `/skills enable <name>`: Re-enables a disabled skill.
- `/skills reload`: Refreshes the list of discovered skills from all tiers.

_Note: `/skills disable` and `/skills enable` default to the `user` scope. Use
`--scope workspace` to manage workspace-specific settings._

### ### From the Terminal
The `gemini skills` command provides management utilities:

```bash

### # List all discovered skills
gemini skills list

### # Link agent skills from a local directory via symlink
# Discovers skills (SKILL.md or */SKILL.md) and creates symlinks in ~/.gemini/skills

### # (or ~/.agents/skills)
gemini skills link /path/to/my-skills-repo

### # Link to the workspace scope (.gemini/skills or .agents/skills)
gemini skills link /path/to/my-skills-repo --scope workspace

### # Install a skill from a Git repository, local directory, or zipped skill file (.skill)
# Uses the user scope by default (~/.gemini/skills or ~/.agents/skills)
gemini skills install https://github.com/user/repo.git
gemini skills install /path/to/local/skill
gemini skills install /path/to/local/my-expertise.skill

### # Install a specific skill from a monorepo or subdirectory using --path
gemini skills install https://github.com/my-org/my-skills.git --path skills/frontend-design

### # Install to the workspace scope (.gemini/skills or .agents/skills)
gemini skills install /path/to/skill --scope workspace

### # Uninstall a skill by name
gemini skills uninstall my-expertise --scope workspace

### # Enable a skill (globally)
gemini skills enable my-expertise

### # Disable a skill. Can use --scope to specify workspace or user (defaults to workspace)
gemini skills disable my-expertise --scope workspace
```

### ## How it Works
1.  **Discovery**: At the start of a session, Gemini CLI scans the discovery
    tiers and injects the name and description of all enabled skills into the
    system prompt.
2.  **Activation**: When Gemini identifies a task matching a skill's
    description, it calls the `activate_skill` tool.
3.  **Consent**: You will see a confirmation prompt in the UI detailing the
    skill's name, purpose, and the directory path it will gain access to.
4.  **Injection**: Upon your approval:
    - The `SKILL.md` body and folder structure is added to the conversation
      history.
    - The skill's directory is added to the agent's allowed file paths, granting
      it permission to read any bundled assets.
5.  **Execution**: The model proceeds with the specialized expertise active. It
    is instructed to prioritize the skill's procedural guidance within reason.

### ### Skill activation
Once a skill is activated (typically by Gemini identifying a task that matches
the skill's description and your approval), its specialized instructions and
resources are loaded into the agent's context. A skill remains active and its
guidance is prioritized for the duration of the session.

### ## Creating your own skills
To create your own skills, see the [Create Agent Skills](./creating-skills.md)
guide.

### ## Variable Substitution
When using a custom system prompt file, you can use the following variables to
dynamically include built-in content:

- `${AgentSkills}`: Injects a complete section (including header) of all
  available agent skills.
- `${SubAgents}`: Injects a complete section (including header) of available
  sub-agents.
- `${AvailableTools}`: Injects a bulleted list of all currently enabled tool
  names.
- Tool Name Variables: Injects the actual name of a tool using the pattern:
  `${toolName}_ToolName` (e.g., `${write_file_ToolName}`,
  `${run_shell_command_ToolName}`).

  This pattern is generated dynamically for all available tools.

### # Custom System Prompt
You are a helpful assistant. ${AgentSkills}
${SubAgents}

### #### Sessions
Captures startup configuration and user prompt submissions.

- `gemini_cli.config`: Emitted once at startup with the CLI configuration.
  - **Attributes**:
    - `model` (string)
    - `embedding_model` (string)
    - `sandbox_enabled` (boolean)
    - `core_tools_enabled` (string)
    - `approval_mode` (string)
    - `api_key_enabled` (boolean)
    - `vertex_ai_enabled` (boolean)
    - `log_user_prompts_enabled` (boolean)
    - `file_filtering_respect_git_ignore` (boolean)
    - `debug_mode` (boolean)
    - `mcp_servers` (string)
    - `mcp_servers_count` (int)
    - `extensions` (string)
    - `extension_ids` (string)
    - `extension_count` (int)
    - `mcp_tools` (string, if applicable)
    - `mcp_tools_count` (int, if applicable)
    - `output_format` ("text", "json", or "stream-json")

- `gemini_cli.user_prompt`: Emitted when a user submits a prompt.
  - **Attributes**:
    - `prompt_length` (int)
    - `prompt_id` (string)
    - `prompt` (string; excluded if `telemetry.logPrompts` is `false`)
    - `auth_type` (string)

### #### Tools
Captures tool executions, output truncation, and Edit behavior.

- `gemini_cli.tool_call`: Emitted for each tool (function) call.
  - **Attributes**:
    - `function_name`
    - `function_args`
    - `duration_ms`
    - `success` (boolean)
    - `decision` ("accept", "reject", "auto_accept", or "modify", if applicable)
    - `error` (if applicable)
    - `error_type` (if applicable)
    - `prompt_id` (string)
    - `tool_type` ("native" or "mcp")
    - `mcp_server_name` (string, if applicable)
    - `extension_name` (string, if applicable)
    - `extension_id` (string, if applicable)
    - `content_length` (int, if applicable)
    - `metadata` (if applicable), which includes for the `AskUser` tool:
      - `ask_user` (object):
        - `question_types` (array of strings)
        - `ask_user_dismissed` (boolean)
        - `ask_user_empty_submission` (boolean)
        - `ask_user_answer_count` (number)
      - `diffStat` (if applicable), which includes:
        - `model_added_lines` (number)
        - `model_removed_lines` (number)
        - `model_added_chars` (number)
        - `model_removed_chars` (number)
        - `user_added_lines` (number)
        - `user_removed_lines` (number)
        - `user_added_chars` (number)
        - `user_removed_chars` (number)

- `gemini_cli.tool_output_truncated`: Output of a tool call was truncated.
  - **Attributes**:
    - `tool_name` (string)
    - `original_content_length` (int)
    - `truncated_content_length` (int)
    - `threshold` (int)
    - `lines` (int)
    - `prompt_id` (string)

- `gemini_cli.edit_strategy`: Edit strategy chosen.
  - **Attributes**:
    - `strategy` (string)

- `gemini_cli.edit_correction`: Edit correction result.
  - **Attributes**:
    - `correction` ("success" | "failure")

- `gen_ai.client.inference.operation.details`: This event provides detailed
  information about the GenAI operation, aligned with [OpenTelemetry GenAI
  semantic conventions for events].
  - **Attributes**:
    - `gen_ai.reque...
[Truncated]

### #### Extensions
Tracks extension lifecycle and settings changes.

- `gemini_cli.extension_install`: An extension was installed.
  - **Attributes**:
    - `extension_name` (string)
    - `extension_version` (string)
    - `extension_source` (string)
    - `status` (string)

- `gemini_cli.extension_uninstall`: An extension was uninstalled.
  - **Attributes**:
    - `extension_name` (string)
    - `status` (string)

- `gemini_cli.extension_enable`: An extension was enabled.
  - **Attributes**:
    - `extension_name` (string)
    - `setting_scope` (string)

- `gemini_cli.extension_disable`: An extension was disabled.
  - **Attributes**:
    - `extension_name` (string)
    - `setting_scope` (string)

- `gemini_cli.extension_update`: An extension was updated.
  - **Attributes**:
    - `extension_name` (string)
    - `extension_version` (string)
    - `extension_previous_version` (string)
    - `extension_source` (string)
    - `status` (string)

### ##### Tools
Measures tool usage and latency.

- `gemini_cli.tool.call.count` (Counter, Int): Counts tool calls.
  - **Attributes**:
    - `function_name`
    - `success` (boolean)
    - `decision` (string: "accept", "reject", "modify", or "auto_accept", if
      applicable)
    - `tool_type` (string: "mcp" or "native", if applicable)

- `gemini_cli.tool.call.latency` (Histogram, ms): Measures tool call latency.
  - **Attributes**:
    - `function_name`

### ### Themes from extensions
[Extensions](../extensions/reference.md#themes) can also provide custom themes.
Once an extension is installed and enabled, its themes are automatically added
to the selection list in the `/theme` command.

Themes from extensions appear with the extension name in parentheses to help you
identify their source, for example: `shades-of-green (green-extension)`.

---

### ## Why trust matters: The impact of an untrusted workspace
When a folder is **untrusted**, the Gemini CLI runs in a restricted "safe mode"
to protect you. In this mode, the following features are disabled:

1.  **Workspace settings are ignored**: The CLI will **not** load the
    `.gemini/settings.json` file from the project. This prevents the loading of
    custom tools and other potentially dangerous configurations.

2.  **Environment variables are ignored**: The CLI will **not** load any `.env`
    files from the project.

3.  **Extension management is restricted**: You **cannot install, update, or
    uninstall** extensions.

4.  **Tool auto-acceptance is disabled**: You will always be prompted before any
    tool is run, even if you have auto-acceptance enabled globally.

5.  **Automatic memory loading is disabled**: The CLI will not automatically
    load files into context from directories specified in local settings.

6.  **MCP servers do not connect**: The CLI will not attempt to connect to any
    [Model Context Protocol (MCP)](../tools/mcp-server.md) servers.

7.  **Custom commands are not loaded**: The CLI will not load any custom
    commands from .toml files, including both project-specific and global user
    commands.

Granting trust to a folder unlocks the full functionality of the Gemini CLI for
that workspace.

### # Set up an MCP server
Connect Gemini CLI to your external databases and services. In this guide,
you'll learn how to extend Gemini CLI's capabilities by installing the GitHub
MCP server and using it to manage your repositories.

### ## Prerequisites
- Gemini CLI installed.
- **Docker:** Required for this specific example (many MCP servers run as Docker
  containers).
- **GitHub token:** A Personal Access Token (PAT) with repo permissions.

### ## How to prepare your credentials
Most MCP servers require authentication. For GitHub, you need a PAT.

1.  Create a [fine-grained PAT](https://github.com/settings/tokens?type=beta).
2.  Grant it **Read** access to **Metadata** and **Contents**, and
    **Read/Write** access to **Issues** and **Pull Requests**.
3.  Store it in your environment:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="github_pat_..."
```

### ## How to configure Gemini CLI
You tell Gemini about new servers by editing your `settings.json`.

1.  Open `~/.gemini/settings.json` (or the project-specific
    `.gemini/settings.json`).
2.  Add the `mcpServers` block. This tells Gemini: "Run this docker container
    and talk to it."

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/modelcontextprotocol/servers/github:latest"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    }
  }
}
```

> **Note:** The `command` is `docker`, and the rest are arguments passed to it.
> We map the local environment variable into the container so your secret isn't
> hardcoded in the config file.

### ## How to verify the connection
Restart Gemini CLI. It will automatically try to start the defined servers.

**Command:** `/mcp list`

You should see: `✓ github: docker ... - Connected`

If you see `Disconnected` or an error, check that Docker is running and your API
token is valid.

### ## Troubleshooting
- **Server won't start?** Try running the docker command manually in your
  terminal to see if it prints an error (e.g., "image not found").
- **Tools not found?** Run `/mcp refresh` to force the CLI to re-query the
  server for its capabilities.

### ## Next steps
- Explore the [MCP servers reference](../../tools/mcp-server.md) to learn about
  SSE and HTTP transports for remote servers.
- Browse the
  [official MCP server list](https://github.com/modelcontextprotocol/servers) to
  find connectors for Slack, Postgres, Google Drive, and more.

### # Get started with Agent Skills
Agent Skills extend Gemini CLI with specialized expertise. In this guide, you'll
learn how to create your first skill, bundle custom scripts, and activate them
during a session.

### ## How to create a skill
A skill is defined by a directory containing a `SKILL.md` file. Let's create an
**API Auditor** skill that helps you verify if local or remote endpoints are
responding correctly.

### ### Create the directory structure
1.  Run the following command to create the folders:

    ```bash
    mkdir -p .gemini/skills/api-auditor/scripts
    ```

### ### Create the definition
1.  Create a file at `.gemini/skills/api-auditor/SKILL.md`. This tells the agent
    _when_ to use the skill and _how_ to behave.

    ```markdown
    ---
    name: api-auditor
    description:
      Expertise in auditing and testing API endpoints. Use when the user asks to
      "check", "test", or "audit" a URL or API.
    ---

    # API Auditor Instructions

    You act as a QA engineer specialized in API reliability. When this skill is
    active, you MUST:

    1.  **Audit**: Use the bundled `scripts/audit.js` utility to check the
        status of the provided URL.
    2.  **Report**: Analyze the output (status codes, latency) and explain any
        failures in plain English.
    3.  **Secure**: Remind the user if they are testing a sensitive endpoint
        without an `https://` protocol.
    ```

### ### Add the tool logic
Skills can bundle resources like scripts.

1.  Create a file at `.gemini/skills/api-auditor/scripts/audit.js`. This is the
    code the agent will run.

    ```javascript
    // .gemini/skills/api-auditor/scripts/audit.js
    const url = process.argv[2];

    if (!url) {
      console.error('Usage: node audit.js <url>');
      process.exit(1);
    }

    console.log(`Auditing ${url}...`);
    fetch(url, { method: 'HEAD' })
      .then((r) => console.log(`Result: Success (Status ${r.status})`))
      .catch((e) => console.error(`Result: Failed (${e.message})`));
    ```

### ## How to verify discovery
Gemini CLI automatically discovers skills in the `.gemini/skills` directory. You
can also use `.agents/skills` as a more generic alternative. Check that it found
your new skill.

**Command:** `/skills list`

You should see `api-auditor` in the list of available skills.

### ## How to use the skill
Now, try it out. Start a new session and ask a question that triggers the
skill's description.

**User:** "Can you audit http://geminicli.com"

Gemini recognizes the request matches the `api-auditor` description and asks for
permission to activate it.

**Model:** (After calling `activate_skill`) "I've activated the **api-auditor**
skill. I'll run the audit script now..."

Gemini then uses the `run_shell_command` tool to execute your bundled Node
script:

`node .gemini/skills/api-auditor/scripts/audit.js http://geminili.com`

### ## Next steps
- Explore the
  [Agent Skills Authoring Guide](../../cli/skills.md#creating-a-skill) to learn
  about more advanced features.
- Learn how to share skills via [Extensions](../../extensions/index.md).

### ## Extension subagents
Extensions can bundle and distribute subagents. See the
[Extensions documentation](../extensions/index.md#subagents) for details on how
to package agents within an extension.

### # Gemini CLI extension best practices
This guide covers best practices for developing, securing, and maintaining
Gemini CLI extensions.

### ### Structure your extension
While simple extensions may contain only a few files, we recommend a organized
structure for complex projects.

```text
my-extension/
├── package.json
├── tsconfig.json
├── gemini-extension.json
├── src/
│   ├── index.ts
│   └── tools/
└── dist/
```

- **Use TypeScript:** We strongly recommend using TypeScript for type safety and
  improved developer experience.
- **Separate source and build:** Keep your source code in `src/` and output
  build artifacts to `dist/`.
- **Bundle dependencies:** If your extension has many dependencies, bundle them
  using a tool like `esbuild` to reduce installation time and avoid conflicts.

### ### Minimal permissions
Only request the permissions your MCP server needs to function. Avoid giving the
model broad access (such as full shell access) if restricted tools are
sufficient.

If your extension uses powerful tools like `run_shell_command`, restrict them in
your `gemini-extension.json` file:

```json
{
  "name": "my-safe-extension",
  "excludeTools": ["run_shell_command(rm -rf *)"]
}
```

This ensures the CLI blocks dangerous commands even if the model attempts to
execute them.

### ### Validate inputs
Your MCP server runs on the user's machine. Always validate tool inputs to
prevent arbitrary code execution or unauthorized filesystem access.

```typescript
// Example: Validating paths
if (!path.resolve(inputPath).startsWith(path.resolve(allowedDir) + path.sep)) {
  throw new Error('Access denied');
}
```

### ## Test and verify
Test your extension thoroughly before releasing it to users.

- **Manual verification:** Use `gemini extensions link` to test your extension
  in a live CLI session. Verify that tools appear in the debug console (F12) and
  that custom commands resolve correctly.
- **Automated testing:** If your extension includes an MCP server, write unit
  tests for your tool logic using a framework like Vitest or Jest. You can test
  MCP tools in isolation by mocking the transport layer.

### ### Extension not loading
If your extension doesn't appear in `/extensions list`:

- **Check the manifest:** Ensure `gemini-extension.json` is in the root
  directory and contains valid JSON.
- **Verify the name:** The `name` field in the manifest must match the extension
  directory name exactly.
- **Restart the CLI:** Extensions are loaded at the start of a session. Restart
  Gemini CLI after making changes to the manifest or linking a new extension.

### ### MCP server failures
If your tools aren't working as expected:

- **Check the logs:** View the CLI logs to see if the MCP server failed to
  start.
- **Test the command:** Run the server's `command` and `args` directly in your
  terminal to ensure it starts correctly outside of Gemini CLI.
- **Debug console:** In interactive mode, press **F12** to open the debug
  console and inspect tool calls and responses.

### # Gemini CLI extensions
Gemini CLI extensions package prompts, MCP servers, custom commands, themes,
hooks, sub-agents, and agent skills into a familiar and user-friendly format.
With extensions, you can expand the capabilities of Gemini CLI and share those
capabilities with others. They are designed to be easily installable and
shareable.

To see what's possible, browse the
[Gemini CLI extension gallery](https://geminicli.com/extensions/browse/).

### ### I want to use extensions
Learn how to discover, install, and manage extensions to enhance your Gemini CLI
experience.

- **[Manage extensions](#manage-extensions):** List and verify your installed
  extensions.
- **[Install extensions](#installation):** Add new capabilities from GitHub or
  local paths.

### ### I want to build extensions
Learn how to create, test, and share your own extensions with the community.

- **[Build extensions](writing-extensions.md):** Create your first extension
  from a template.
- **[Best practices](best-practices.md):** Learn how to build secure and
  reliable extensions.
- **[Publish to the gallery](releasing.md):** Share your work with the world.

### ## Manage extensions
Use the interactive `/extensions` command to verify your installed extensions
and their status:

```bash
/extensions list
```

You can also manage extensions from your terminal using the `gemini extensions`
command group:

```bash
gemini extensions list
```

### # Extension reference
This guide covers the `gemini extensions` commands and the structure of the
`gemini-extension.json` configuration file.

### ## Manage extensions
Use the `gemini extensions` command group to manage your extensions from the
terminal.

Note that commands like `gemini extensions install` are not supported within the
CLI's interactive mode. However, you can use the `/extensions list` command to
view installed extensions. All management operations, including updates to slash
commands, take effect only after you restart the CLI session.

### ### Install an extension
Install an extension by providing its GitHub repository URL or a local file
path.

Gemini CLI creates a copy of the extension during installation. You must run
`gemini extensions update` to pull changes from the source. To install from
GitHub, you must have `git` installed on your machine.

```bash
gemini extensions install <source> [--ref <ref>] [--auto-update] [--pre-release] [--consent]
```

- `<source>`: The GitHub URL or local path of the extension.
- `--ref`: The git ref (branch, tag, or commit) to install.
- `--auto-update`: Enable automatic updates for this extension.
- `--pre-release`: Enable installation of pre-release versions.
- `--consent`: Acknowledge security risks and skip the confirmation prompt.

### ### Uninstall an extension
To uninstall one or more extensions, use the `uninstall` command:

```bash
gemini extensions uninstall <name...>
```

### ### Disable an extension
Extensions are enabled globally by default. You can disable an extension
entirely or for a specific workspace.

```bash
gemini extensions disable <name> [--scope <scope>]
```

- `<name>`: The name of the extension to disable.
- `--scope`: The scope to disable the extension in (`user` or `workspace`).

### ### Enable an extension
Re-enable a disabled extension using the `enable` command:

```bash
gemini extensions enable <name> [--scope <scope>]
```

- `<name>`: The name of the extension to enable.
- `--scope`: The scope to enable the extension in (`user` or `workspace`).

### ### Update an extension
Update an extension to the version specified in its `gemini-extension.json`
file.

```bash
gemini extensions update <name>
```

To update all installed extensions at once:

```bash
gemini extensions update --all
```

### ### Create an extension from a template
Create a new extension directory using a built-in template.

```bash
gemini extensions new <path> [template]
```

- `<path>`: The directory to create.
- `[template]`: The template to use (e.g., `mcp-server`, `context`,
  `custom-commands`).

### ### Link a local extension
Create a symbolic link between your development directory and the Gemini CLI
extensions directory. This lets you test changes immediately without
reinstalling.

```bash
gemini extensions link <path>
```

### ## Extension format
Gemini CLI loads extensions from `<home>/.gemini/extensions`. Each extension
must have a `gemini-extension.json` file in its root directory.

### ### `gemini-extension.json`
The manifest file defines the extension's behavior and configuration.

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "My awesome extension",
  "mcpServers": {
    "my-server": {
      "command": "node my-server.js"
    }
  },
  "contextFileName": "GEMINI.md",
  "excludeTools": ["run_shell_command"]
}
```

- `name`: A unique identifier for the extension. Use lowercase letters, numbers,
  and dashes. This name must match the extension's directory name.
- `version`: The current version of the extension.
- `description`: A short summary shown in the extension gallery.
- <a id="mcp-servers"></a>`mcpServers`: A map of Model Context Protocol (MCP)
  servers. Extension servers follow the same format as standard
  [CLI configuration](../reference/configuration.md).
- `contextFileName`: The name of the context file (defaults to `GEMINI.md`). Can
  also be an array of strings to load multiple context files.
- `excludeTools`: An array of tools to block from the model. You can restrict
  specific arguments, such as `run_shell_command(rm -rf)`.
- `themes`: An optional list of themes provided by the extension. See
  [Themes](../cli/themes.md) for more information.

### ### Extension settings
Extensions can define settings that users provide during installation, such as
API keys or URLs. These values are stored in a `.env` file within the extension
directory.

To define settings, add a `settings` array to your manifest:

```json
{
  "name": "my-api-extension",
  "version": "1.0.0",
  "settings": [
    {
      "name": "API Key",
      "description": "Your API key for the service.",
      "envVar": "MY_API_KEY",
      "sensitive": true
    }
  ]
}
```

- `name`: The setting's display name.
- `description`: A clear explanation of the setting.
- `envVar`: The environment variable name where the value is stored.
- `sensitive`: If `true`, the value is stored in the system keychain and
  obfuscated in the UI.

To update an extension's settings:

```bash
gemini extensions config <name> [setting] [--scope <scope>]
```

### ### Agent skills
Bundle [agent skills](../cli/skills.md) to provide specialized workflows. Place
skill definitions in a `skills/` directory. For example,
`skills/security-audit/SKILL.md` exposes a `security-audit` skill.

### # Release extensions
Release Gemini CLI extensions to your users through a Git repository or GitHub
Releases.

Git repository releases are the simplest approach and offer the most flexibility
for managing development branches. GitHub Releases are more efficient for
initial installations because they ship as single archives rather than requiring
a full `git clone`. Use GitHub Releases if you need to include platform-specific
binary files.

### ## List your extension in the gallery
The [Gemini CLI extension gallery](https://geminicli.com/extensions/browse/)
automatically indexes public extensions to help users discover your work. You
don't need to submit an issue or email us to list your extension.

To have your extension automatically discovered and listed:

1.  **Use a public repository:** Ensure your extension is hosted in a public
    GitHub repository.
2.  **Add the GitHub topic:** Add the `gemini-cli-extension` topic to your
    repository's **About** section. Our crawler uses this topic to find new
    extensions.
3.  **Place the manifest at the root:** Ensure your `gemini-extension.json` file
    is in the absolute root of the repository or the release archive.

Our system crawls tagged repositories daily. Once you tag your repository, your
extension will appear in the gallery if it passes validation.

### # Build Gemini CLI extensions
Gemini CLI extensions let you expand the capabilities of Gemini CLI by adding
custom tools, commands, and context. This guide walks you through creating your
first extension, from setting up a template to adding custom functionality and
linking it for local development.

### ## Extension features
Extensions offer several ways to customize Gemini CLI. Use this table to decide
which features your extension needs.

| Feature                                                        | What it is                                                                                                         | When to use it                                                                                                                                                                                                                                                                                 | Invoked by            |
| :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- |
| **[MCP server](reference.md#mcp-servers)**                     | A standard way to expose new tools and data sources to the model.                                                  | Use this when you want the model to be able to _do_ new things, like fetching data from an internal API, querying a database, or controlling a local application. We also support MCP resources (which can replace custom commands) and system instructions (which can replace custom context) | Model                 |
| **[Custom commands](../cli/custom-commands.md)**               | A shortcut (like `/my-cmd`) that executes a pre-defined prompt or shell command.                                   | Use this for repetitive tasks or to save long, complex prompts that you use frequently. Great for automation.                                                                                                  ...
[Truncated]

### ## Step 1: Create a new extension
The easiest way to start is by using a built-in template. We'll use the
`mcp-server` example as our foundation.

Run the following command to create a new directory called `my-first-extension`
with the template files:

```bash
gemini extensions new my-first-extension mcp-server
```

This creates a directory with the following structure:

```
my-first-extension/
├── example.js
├── gemini-extension.json
└── package.json
```

### ## Step 2: Understand the extension files
Your new extension contains several key files that define its behavior.

### ### `gemini-extension.json`
The manifest file tells Gemini CLI how to load and use your extension.

```json
{
  "name": "mcp-server-example",
  "version": "1.0.0",
  "mcpServers": {
    "nodeServer": {
      "command": "node",
      "args": ["${extensionPath}${/}example.js"],
      "cwd": "${extensionPath}"
    }
  }
}
```

- `name`: The unique name for your extension.
- `version`: The version of your extension.
- `mcpServers`: Defines Model Context Protocol (MCP) servers to add new tools.
  - `command`, `args`, `cwd`: Specify how to start your server. The
    `${extensionPath}` variable is replaced with the absolute path to your
    extension's directory.

### ### `example.js`
This file contains the source code for your MCP server. It uses the
`@modelcontextprotocol/sdk` to define tools.

```javascript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'prompt-server',
  version: '1.0.0',
});

// Registers a new tool named 'fetch_posts'
server.registerTool(
  'fetch_posts',
  {
    description: 'Fetches a list of posts from a public API.',
    inputSchema: z.object({}).shape,
  },
  async () => {
    const apiResponse = await fetch(
      'https://jsonplaceholder.typicode.com/posts',
    );
    const posts = await apiResponse.json();
    const response = { posts: posts.slice(0, 5) };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### ## Step 3: Add extension settings
Some extensions need configuration, such as API keys or user preferences. Let's
add a setting for an API key.

1.  Open `gemini-extension.json`.
2.  Add a `settings` array to the configuration:

    ```json
    {
      "name": "mcp-server-example",
      "version": "1.0.0",
      "settings": [
        {
          "name": "API Key",
          "description": "The API key for the service.",
          "envVar": "MY_SERVICE_API_KEY",
          "sensitive": true
        }
      ],
      "mcpServers": {
        // ...
      }
    }
    ```

When a user installs this extension, Gemini CLI will prompt them to enter the
"API Key". The value will be stored securely in the system keychain (because
`sensitive` is true) and injected into the MCP server's process as the
`MY_SERVICE_API_KEY` environment variable.

### ## Step 4: Link your extension
Link your extension to your Gemini CLI installation for local development.

1.  **Install dependencies:**

    ```bash
    cd my-first-extension
    npm install
    ```

2.  **Link the extension:**

    The `link` command creates a symbolic link from the Gemini CLI extensions
    directory to your development directory. Changes you make are reflected
    immediately.

    ```bash
    gemini extensions link .
    ```

Restart your Gemini CLI session to use the new `fetch_posts` tool. Test it by
asking: "fetch posts".

### ## Step 6: Add a custom `GEMINI.md`
Provide persistent context to the model by adding a `GEMINI.md` file to your
extension. This is useful for setting behavior or providing essential tool
information.

1.  Create a file named `GEMINI.md` in the root of your extension directory:

    ```markdown
    # My First Extension Instructions

    You are an expert developer assistant. When the user asks you to fetch
    posts, use the `fetch_posts` tool. Be concise in your responses.
    ```

2.  Update your `gemini-extension.json` to load this file:

    ```json
    {
      "name": "my-first-extension",
      "version": "1.0.0",
      "contextFileName": "GEMINI.md",
      "mcpServers": {
        "nodeServer": {
          "command": "node",
          "args": ["${extensionPath}${/}example.js"],
          "cwd": "${extensionPath}"
        }
      }
    }
    ```

Restart Gemini CLI. The model now has the context from your `GEMINI.md` file in
every session where the extension is active.

### ## (Optional) Step 7: Add an Agent Skill
[Agent Skills](../cli/skills.md) bundle specialized expertise and workflows.
Skills are activated only when needed, which saves context tokens.

1.  Create a `skills` directory and a subdirectory for your skill:

    ```bash
    mkdir -p skills/security-audit
    ```

2.  Create a `skills/security-audit/SKILL.md` file:

    ```markdown
    ---
    name: security-audit
    description:
      Expertise in auditing code for security vulnerabilities. Use when the user
      asks to "check for security issues" or "audit" their changes.
    ---

    # Security Auditor

    You are an expert security researcher. When auditing code:

    1. Look for common vulnerabilities (OWASP Top 10).
    2. Check for hardcoded secrets or API keys.
    3. Suggest remediation steps for any findings.
    ```

Gemini CLI automatically discovers skills bundled with your extension. The model
activates them when it identifies a relevant task.

### ## Step 8: Release your extension
When your extension is ready, share it with others via a Git repository or
GitHub Releases. Refer to the [Extension Releasing Guide](./releasing.md) for
detailed instructions and learn how to list your extension in the gallery.

### ### Matchers and tool names
For `BeforeTool` and `AfterTool` events, the `matcher` field in your settings is
compared against the name of the tool being executed.

- **Built-in Tools**: You can match any built-in tool (e.g., `read_file`,
  `run_shell_command`). See the [Tools Reference](/docs/tools) for a full list
  of available tool names.
- **MCP Tools**: Tools from MCP servers follow the naming pattern
  `mcp__<server_name>__<tool_name>`.
- **Regex Support**: Matchers support regular expressions (e.g.,
  `matcher: "read_.*"` matches all file reading tools).

### ### `BeforeTool`
Fires before a tool is invoked. Used for argument validation, security checks,
and parameter rewriting.

- **Input Fields**:
  - `tool_name`: (`string`) The name of the tool being called.
  - `tool_input`: (`object`) The raw arguments generated by the model.
  - `mcp_context`: (`object`) Optional metadata for MCP-based tools.
- **Relevant Output Fields**:
  - `decision`: Set to `"deny"` (or `"block"`) to prevent the tool from
    executing.
  - `reason`: Required if denied. This text is sent **to the agent** as a tool
    error, allowing it to respond or retry.
  - `hookSpecificOutput.tool_input`: An object that **merges with and
    overrides** the model's arguments before execution.
  - `continue`: Set to `false` to **kill the entire agent loop** immediately.
- **Exit Code 2 (Block Tool)**: Prevents execution. Uses `stderr` as the
  `reason` sent to the agent. **The turn continues.**

### ### `AfterTool`
Fires after a tool executes. Used for result auditing, context injection, or
hiding sensitive output from the agent.

- **Input Fields**:
  - `tool_name`: (`string`)
  - `tool_input`: (`object`) The original arguments.
  - `tool_response`: (`object`) The result containing `llmContent`,
    `returnDisplay`, and optional `error`.
  - `mcp_context`: (`object`)
- **Relevant Output Fields**:
  - `decision`: Set to `"deny"` to hide the real tool output from the agent.
  - `reason`: Required if denied. This text **replaces** the tool result sent
    back to the model.
  - `hookSpecificOutput.additionalContext`: Text that is **appended** to the
    tool result for the agent.
  - `continue`: Set to `false` to **kill the entire agent loop** immediately.
- **Exit Code 2 (Block Result)**: Hides the tool result. Uses `stderr` as the
  replacement content sent to the agent. **The turn continues.**

---

### ## Packaging as an extension
While project-level hooks are great for specific repositories, you can share
your hooks across multiple projects by packaging them as a
[Gemini CLI extension](https://www.google.com/search?q=../extensions/index.md).
This provides version control, easy distribution, and centralized management.

### # Gemini CLI companion plugin: Interface specification
> Last Updated: September 15, 2025

This document defines the contract for building a companion plugin to enable
Gemini CLI's IDE mode. For VS Code, these features (native diffing, context
awareness) are provided by the official extension
([marketplace](https://marketplace.visualstudio.com/items?itemName=Google.gemini-cli-vscode-ide-companion)).
This specification is for contributors who wish to bring similar functionality
to other editors like JetBrains IDEs, Sublime Text, etc.

### ### 1. Transport layer: MCP over HTTP
The plugin **MUST** run a local HTTP server that implements the **Model Context
Protocol (MCP)**.

- **Protocol:** The server must be a valid MCP server. We recommend using an
  existing MCP SDK for your language of choice if available.
- **Endpoint:** The server should expose a single endpoint (e.g., `/mcp`) for
  all MCP communication.
- **Port:** The server **MUST** listen on a dynamically assigned port (i.e.,
  listen on port `0`).

### ### 2. Discovery mechanism: The port file
For Gemini CLI to connect, it needs to discover which IDE instance it's running
in and what port your server is using. The plugin **MUST** facilitate this by
creating a "discovery file."

- **How the CLI finds the file:** The CLI determines the Process ID (PID) of the
  IDE it's running in by traversing the process tree. It then looks for a
  discovery file that contains this PID in its name.
- **File location:** The file must be created in a specific directory:
  `os.tmpdir()/gemini/ide/`. Your plugin must create this directory if it
  doesn't exist.
- **File naming convention:** The filename is critical and **MUST** follow the
  pattern: `gemini-ide-server-${PID}-${PORT}.json`
  - `${PID}`: The process ID of the parent IDE process. Your plugin must
    determine this PID and include it in the filename.
  - `${PORT}`: The port your MCP server is listening on.
- **File content and workspace validation:** The file **MUST** contain a JSON
  object with the following structure:

  ```json
  {
    "port": 12345,
    "workspacePath": "/path/to/project1:/path/to/project2",
    "authToken": "a-very-secret-token",
    "ideInfo": {
      "name": "vscode",
      "displayName": "VS Code"
    }
  }
  ```
  - `port` (number, required): The port of the MCP server.
  - `workspacePath` (string, required): A list of all open workspace root paths,
    delimited by the OS-specific path separator (`:` for Linux/macOS, `;` for
    Windows). The CLI uses this path to ensure it's running in the same project
    folder that's open in the IDE. If the CLI's current working directory is not
    a sub-directory of `workspacePath`, the connection will be rejected. Your
    plugin **MUST** provide the correct, absolute path(s) to the root of the
    open workspace(s).
  - `authToken` (string, required): A secret token for securing the connection.
    The CLI will include this token in an `Authorization: Bearer <token>` header
    on all requests.
  - `ideInfo` (object, required): Information abo...
[Truncated]

### ### `openDiff` tool
The plugin **MUST** register an `openDiff` tool on its MCP server.

- **Description:** This tool instructs the IDE to open a modifiable diff view
  for a specific file.
- **Request (`OpenDiffRequest`):** The tool is invoked via a `tools/call`
  request. The `arguments` field within the request's `params` **MUST** be an
  `OpenDiffRequest` object.

  ```typescript
  interface OpenDiffRequest {
    // The absolute path to the file to be diffed.
    filePath: string;
    // The proposed new content for the file.
    newContent: string;
  }
  ```

- **Response (`CallToolResult`):** The tool **MUST** immediately return a
  `CallToolResult` to acknowledge the request and report whether the diff view
  was successfully opened.
  - On Success: If the diff view was opened successfully, the response **MUST**
    contain empty content (i.e., `content: []`).
  - On Failure: If an error prevented the diff view from opening, the response
    **MUST** have `isError: true` and include a `TextContent` block in the
    `content` array describing the error.

  The actual outcome of the diff (acceptance or rejection) is communicated
  asynchronously via notifications.

### ### `closeDiff` tool
The plugin **MUST** register a `closeDiff` tool on its MCP server.

- **Description:** This tool instructs the IDE to close an open diff view for a
  specific file.
- **Request (`CloseDiffRequest`):** The tool is invoked via a `tools/call`
  request. The `arguments` field within the request's `params` **MUST** be an
  `CloseDiffRequest` object.

  ```typescript
  interface CloseDiffRequest {
    // The absolute path to the file whose diff view should be closed.
    filePath: string;
  }
  ```

- **Response (`CallToolResult`):** The tool **MUST** return a `CallToolResult`.
  - On Success: If the diff view was closed successfully, the response **MUST**
    include a single **TextContent** block in the content array containing the
    file's final content before closing.
  - On Failure: If an error prevented the diff view from closing, the response
    **MUST** have `isError: true` and include a `TextContent` block in the
    `content` array describing the error.

### ## IV. The lifecycle interface
The plugin **MUST** manage its resources and the discovery file correctly based
on the IDE's lifecycle.

- **On activation (IDE startup/plugin enabled):**
  1.  Start the MCP server.
  2.  Create the discovery file.
- **On deactivation (IDE shutdown/plugin disabled):**
  1.  Stop the MCP server.
  2.  Delete the discovery file.

### ### Connection errors
- **Message:**
  `🔴 Disconnected: Failed to connect to IDE companion extension in [IDE Name]. Please ensure the extension is running. To install the extension, run /ide install.`
  - **Cause:** Gemini CLI could not find the necessary environment variables
    (`GEMINI_CLI_IDE_WORKSPACE_PATH` or `GEMINI_CLI_IDE_SERVER_PORT`) to connect
    to the IDE. This usually means the IDE companion extension is not running or
    did not initialize correctly.
  - **Solution:**
    1.  Make sure you have installed the **Gemini CLI Companion** extension in
        your IDE and that it is enabled.
    2.  Open a new terminal window in your IDE to ensure it picks up the correct
        environment.

- **Message:**
  `🔴 Disconnected: IDE connection error. The connection was lost unexpectedly. Please try reconnecting by running /ide enable`
  - **Cause:** The connection to the IDE companion was lost.
  - **Solution:** Run `/ide enable` to try and reconnect. If the issue
    continues, open a new terminal window or restart your IDE.

### ## Use Gemini CLI
User-focused guides and tutorials for daily development workflows.

- **[File management](./cli/tutorials/file-management.md):** How to work with
  local files and directories.
- **[Get started with Agent skills](./cli/tutorials/skills-getting-started.md):**
  Getting started with specialized expertise.
- **[Manage context and memory](./cli/tutorials/memory-management.md):**
  Managing persistent instructions and facts.
- **[Execute shell commands](./cli/tutorials/shell-commands.md):** Executing
  system commands safely.
- **[Manage sessions and history](./cli/tutorials/session-management.md):**
  Resuming, managing, and rewinding conversations.
- **[Plan tasks with todos](./cli/tutorials/task-planning.md):** Using todos for
  complex workflows.
- **[Web search and fetch](./cli/tutorials/web-tools.md):** Searching and
  fetching content from the web.
- **[Set up an MCP server](./cli/tutorials/mcp-setup.md):** Set up an MCP
  server.
- **[Automate tasks](./cli/tutorials/automation.md):** Automate tasks.

### ## Features
Technical documentation for each capability of Gemini CLI.

- **[Activate skill (tool)](./tools/activate-skill.md):** Internal mechanism for
  loading expert procedures.
- **[Ask user (tool)](./tools/ask-user.md):** Internal dialog system for
  clarification.
- **[Checkpointing](./cli/checkpointing.md):** Automatic session snapshots.
- **[File system (tool)](./tools/file-system.md):** Technical details for local
  file operations.
- **[Headless mode](./cli/headless.md):** Programmatic and scripting interface.
- **[Internal documentation (tool)](./tools/internal-docs.md):** Technical
  lookup for CLI features.
- **[Memory (tool)](./tools/memory.md):** Storage details for persistent facts.
- **[Model routing](./cli/model-routing.md):** Automatic fallback resilience.
- **[Plan mode 🧪](./cli/plan-mode.md):** Use a safe, read-only mode for
  planning complex changes.
- **[Subagents 🧪](./core/subagents.md):** Using specialized agents for specific
  tasks.
- **[Remote subagents 🧪](./core/remote-agents.md):** Connecting to and using
  remote agents.
- **[Sandboxing](./cli/sandbox.md):** Isolate tool execution.
- **[Shell (tool)](./tools/shell.md):** Detailed system execution parameters.
- **[Telemetry](./cli/telemetry.md):** Usage and performance metric details.
- **[Todo (tool)](./tools/todos.md):** Progress tracking specification.
- **[Token caching](./cli/token-caching.md):** Performance optimization.
- **[Web fetch (tool)](./tools/web-fetch.md):** URL retrieval and extraction
  details.
- **[Web search (tool)](./tools/web-search.md):** Google Search integration
  technicals.

### ### `/commands`
- **Description:** Manage custom slash commands loaded from `.toml` files.
- **Sub-commands:**
  - **`reload`**:
    - **Description:** Reload custom command definitions from all sources
      (user-level `~/.gemini/commands/`, project-level
      `<project>/.gemini/commands/`, MCP prompts, and extensions). Use this to
      pick up new or modified `.toml` files without restarting the CLI.
    - **Usage:** `/commands reload`

### ### `/extensions`
- **Description:** Lists all active extensions in the current Gemini CLI
  session. See [Gemini CLI Extensions](../extensions/index.md).

### ### `/mcp`
- **Description:** Manage configured Model Context Protocol (MCP) servers.
- **Sub-commands:**
  - **`auth`**:
    - **Description:** Authenticate with an OAuth-enabled MCP server.
    - **Usage:** `/mcp auth <server-name>`
    - **Details:** If `<server-name>` is provided, it initiates the OAuth flow
      for that server. If no server name is provided, it lists all configured
      servers that support OAuth authentication.
  - **`desc`**
    - **Description:** List configured MCP servers and tools with descriptions.
  - **`list`** or **`ls`**:
    - **Description:** List configured MCP servers and tools. This is the
      default action if no subcommand is specified.
  - **`refresh`**:
    - **Description:** Restarts all MCP servers and re-discovers their available
      tools.
  - **`schema`**:
    - **Description:** List configured MCP servers and tools with descriptions
      and schemas.

### ### `/skills`
- **Description:** Manage Agent Skills, which provide on-demand expertise and
  specialized workflows.
- **Sub-commands:**
  - **`disable <name>`**:
    - **Description:** Disable a specific skill by name.
    - **Usage:** `/skills disable <name>`
  - **`enable <name>`**:
    - **Description:** Enable a specific skill by name.
    - **Usage:** `/skills enable <name>`
  - **`list`**:
    - **Description:** List all discovered skills and their current status
      (enabled/disabled).
  - **`reload`**:
    - **Description:** Refresh the list of discovered skills from all tiers
      (workspace, user, and extensions).

### #### `ui`
- **`ui.theme`** (string):
  - **Description:** The color theme for the UI. See the CLI themes guide for
    available options.
  - **Default:** `undefined`

- **`ui.autoThemeSwitching`** (boolean):
  - **Description:** Automatically switch between default light and dark themes
    based on terminal background color.
  - **Default:** `true`

- **`ui.terminalBackgroundPollingInterval`** (number):
  - **Description:** Interval in seconds to poll the terminal background color.
  - **Default:** `60`

- **`ui.customThemes`** (object):
  - **Description:** Custom theme definitions.
  - **Default:** `{}`

- **`ui.hideWindowTitle`** (boolean):
  - **Description:** Hide the window title bar
  - **Default:** `false`
  - **Requires restart:** Yes

- **`ui.inlineThinkingMode`** (enum):
  - **Description:** Display model thinking inline: off or full.
  - **Default:** `"off"`
  - **Values:** `"off"`, `"full"`

- **`ui.showStatusInTitle`** (boolean):
  - **Description:** Show Gemini CLI model thoughts in the terminal window title
    during the working phase
  - **Default:** `false`

- **`ui.dynamicWindowTitle`** (boolean):
  - **Description:** Update the terminal window title with current status icons
    (Ready: ◇, Action Required: ✋, Working: ✦)
  - **Default:** `true`

- **`ui.showHomeDirectoryWarning`** (boolean):
  - **Description:** Show a warning when running Gemini CLI in the home
    directory.
  - **Default:** `true`
  - **Requires restart:** Yes

- **`ui.showCompatibilityWarnings`** (boolean):
  - **Description:** Show warnings about terminal or OS compatibility issues.
  - **Default:** `true`
  - **Requires restart:** Yes

- **`ui.hideTips`** (boolean):
  - **Description:** Hide helpful tips in the UI
  - **Default:** `false`

- **`ui.showShortcutsHint`** (boolean):
  - **Description:** Show the "? for shortcuts" hint above the input.
  - **Default:** `true`

- **`ui.hideBanner`** (boolean):
  - **Description:** Hide the application banner
  - **Default:** `false`

- ...
[Truncated]

### #### `mcp`
- **`mcp.serverCommand`** (string):
  - **Description:** Command to start an MCP server.
  - **Default:** `undefined`
  - **Requires restart:** Yes

- **`mcp.allowed`** (array):
  - **Description:** A list of MCP servers to allow.
  - **Default:** `undefined`
  - **Requires restart:** Yes

- **`mcp.excluded`** (array):
  - **Description:** A list of MCP servers to exclude.
  - **Default:** `undefined`
  - **Requires restart:** Yes

### #### `skills`
- **`skills.enabled`** (boolean):
  - **Description:** Enable Agent Skills.
  - **Default:** `true`
  - **Requires restart:** Yes

- **`skills.disabled`** (array):
  - **Description:** List of disabled skills.
  - **Default:** `[]`
  - **Requires restart:** Yes

### #### `admin`
- **`admin.secureModeEnabled`** (boolean):
  - **Description:** If true, disallows yolo mode from being used.
  - **Default:** `false`

- **`admin.extensions.enabled`** (boolean):
  - **Description:** If false, disallows extensions from being installed or
    used.
  - **Default:** `true`

- **`admin.mcp.enabled`** (boolean):
  - **Description:** If false, disallows MCP servers from being used.
  - **Default:** `true`

- **`admin.mcp.config`** (object):
  - **Description:** Admin-configured MCP servers.
  - **Default:** `{}`

- **`admin.skills.enabled`** (boolean):
  - **Description:** If false, disallows agent skills from being used.
  - **Default:** `true`
  <!-- SETTINGS-AUTOGEN:END -->

### #### `mcpServers`
Configures connections to one or more Model-Context Protocol (MCP) servers for
discovering and using custom tools. Gemini CLI attempts to connect to each
configured MCP server to discover available tools. If multiple MCP servers
expose a tool with the same name, the tool names will be prefixed with the
server alias you defined in the configuration (e.g.,
`serverAlias__actualToolName`) to avoid conflicts. Note that the system might
strip certain schema properties from MCP tool definitions for compatibility. At
least one of `command`, `url`, or `httpUrl` must be provided. If multiple are
specified, the order of precedence is `httpUrl`, then `url`, then `command`.

- **`mcpServers.<SERVER_NAME>`** (object): The server parameters for the named
  server.
  - `command` (string, optional): The command to execute to start the MCP server
    via standard I/O.
  - `args` (array of strings, optional): Arguments to pass to the command.
  - `env` (object, optional): Environment variables to set for the server
    process.
  - `cwd` (string, optional): The working directory in which to start the
    server.
  - `url` (string, optional): The URL of an MCP server that uses Server-Sent
    Events (SSE) for communication.
  - `httpUrl` (string, optional): The URL of an MCP server that uses streamable
    HTTP for communication.
  - `headers` (object, optional): A map of HTTP headers to send with requests to
    `url` or `httpUrl`.
  - `timeout` (number, optional): Timeout in milliseconds for requests to this
    MCP server.
  - `trust` (boolean, optional): Trust this server and bypass all tool call
    confirmations.
  - `description` (string, optional): A brief description of the server, which
    may be used for display purposes.
  - `includeTools` (array of strings, optional): List of tool names to include
    from this MCP server. When specified, only the tools listed here will be
    available from this server (allowlist behavior). If not specified, all tools
    from the server...
[Truncated]

### ### Example `settings.json`
Here is an example of a `settings.json` file with the nested structure, new as
of v0.3.0:

```json
{
  "general": {
    "vimMode": true,
    "preferredEditor": "code",
    "sessionRetention": {
      "enabled": true,
      "maxAge": "30d",
      "maxCount": 100
    }
  },
  "ui": {
    "theme": "GitHub",
    "hideBanner": true,
    "hideTips": false,
    "customWittyPhrases": [
      "You forget a thousand things every day. Make sure this is one of ’em",
      "Connecting to AGI"
    ]
  },
  "tools": {
    "sandbox": "docker",
    "discoveryCommand": "bin/get_tools",
    "callCommand": "bin/call_tool",
    "exclude": ["write_file"]
  },
  "mcpServers": {
    "mainServer": {
      "command": "bin/mcp_server.py"
    },
    "anotherServer": {
      "command": "node",
      "args": ["mcp_server.js", "--verbose"]
    }
  },
  "telemetry": {
    "enabled": true,
    "target": "local",
    "otlpEndpoint": "http://localhost:4317",
    "logPrompts": true
  },
  "privacy": {
    "usageStatisticsEnabled": true
  },
  "model": {
    "name": "gemini-1.5-pro-latest",
    "maxSessionTurns": 10,
    "summarizeToolOutput": {
      "run_shell_command": {
        "tokenBudget": 100
      }
    }
  },
  "context": {
    "fileName": ["CONTEXT.md", "GEMINI.md"],
    "includeDirectories": ["path/to/dir1", "~/path/to/dir2", "../path/to/dir3"],
    "loadFromIncludeDirectories": true,
    "fileFiltering": {
      "respectGitIgnore": false
    }
  },
  "advanced": {
    "excludedEnvVars": ["DEBUG", "DEBUG_MODE", "NODE_ENV"]
  }
}
```

### ## Command-line arguments
Arguments passed directly when running the CLI can override other configurations
for that specific session.

- **`--model <model_name>`** (**`-m <model_name>`**):
  - Specifies the Gemini model to use for this session.
  - Example: `npm start -- --model gemini-3-pro-preview`
- **`--prompt <your_prompt>`** (**`-p <your_prompt>`**):
  - **Deprecated:** Use positional arguments instead.
  - Used to pass a prompt directly to the command. This invokes Gemini CLI in a
    non-interactive mode.
- **`--prompt-interactive <your_prompt>`** (**`-i <your_prompt>`**):
  - Starts an interactive session with the provided prompt as the initial input.
  - The prompt is processed within the interactive session, not before it.
  - Cannot be used when piping input from stdin.
  - Example: `gemini -i "explain this code"`
- **`--output-format <format>`**:
  - **Description:** Specifies the format of the CLI output for non-interactive
    mode.
  - **Values:**
    - `text`: (Default) The standard human-readable output.
    - `json`: A machine-readable JSON output.
    - `stream-json`: A streaming JSON output that emits real-time events.
  - **Note:** For structured output and scripting, use the
    `--output-format json` or `--output-format stream-json` flag.
- **`--sandbox`** (**`-s`**):
  - Enables sandbox mode for this session.
- **`--debug`** (**`-d`**):
  - Enables debug mode for this session, providing more verbose output. Open the
    debug console with F12 to see the additional logging.

- **`--help`** (or **`-h`**):
  - Displays help information about command-line arguments.
- **`--yolo`**:
  - Enables YOLO mode, which automatically approves all tool calls.
- **`--approval-mode <mode>`**:
  - Sets the approval mode for tool calls. Available modes:
    - `default`: Prompt for approval on each tool call (default behavior)
    - `auto_edit`: Automatically approve edit tools (replace, write_file) while
      prompting for others
    - `yolo`: Automatically approve all tool calls (equ...
[Truncated]

### #### Tool Name
The `toolName` in the rule must match the name of the tool being called.

- **Wildcards**: For Model-hosting-protocol (MCP) servers, you can use a
  wildcard. A `toolName` of `my-server__*` will match any tool from the
  `my-server` MCP.

### ## Rule matching
When a tool call is made, the engine checks it against all active rules,
starting from the highest priority. The first rule that matches determines the
outcome.

A rule matches a tool call if all of its conditions are met:

1.  **Tool name**: The `toolName` in the rule must match the name of the tool
    being called.
    - **Wildcards**: For Model-hosting-protocol (MCP) servers, you can use a
      wildcard. A `toolName` of `my-server__*` will match any tool from the
      `my-server` MCP.
2.  **Arguments pattern**: If `argsPattern` is specified, the tool's arguments
    are converted to a stable JSON string, which is then tested against the
    provided regular expression. If the arguments don't match the pattern, the
    rule does not apply.

### # (Optional) The name of an MCP server. Can be combined with toolName
# to form a composite name like "mcpName__toolName".
mcpName = "my-custom-server"

### ### Special syntax for MCP tools
You can create rules that target tools from Model-hosting-protocol (MCP) servers
using the `mcpName` field or a wildcard pattern.

**1. Using `mcpName`**

To target a specific tool from a specific server, combine `mcpName` and
`toolName`.

```toml

### # Allows the `search` tool on the `my-jira-server` MCP
[[rule]]
mcpName = "my-jira-server"
toolName = "search"
decision = "allow"
priority = 200
```

**2. Using a wildcard**

To create a rule that applies to _all_ tools on a specific MCP server, specify
only the `mcpName`.

```toml

### # Denies all tools from the `untrusted-server` MCP
[[rule]]
mcpName = "untrusted-server"
decision = "deny"
priority = 500
deny_message = "This server is not trusted by the admin."
```

### ## Core concepts
- **Tool (`tools.ts`):** An interface and base class (`BaseTool`) that defines
  the contract for all tools. Each tool must have:
  - `name`: A unique internal name (used in API calls to Gemini).
  - `displayName`: A user-friendly name.
  - `description`: A clear explanation of what the tool does, which is provided
    to the Gemini model.
  - `parameterSchema`: A JSON schema defining the parameters that the tool
    accepts. This is crucial for the Gemini model to understand how to call the
    tool correctly.
  - `validateToolParams()`: A method to validate incoming parameters.
  - `getDescription()`: A method to provide a human-readable description of what
    the tool will do with specific parameters before execution.
  - `shouldConfirmExecute()`: A method to determine if user confirmation is
    required before execution (e.g., for potentially destructive operations).
  - `execute()`: The core method that performs the tool's action and returns a
    `ToolResult`.

- **`ToolResult` (`tools.ts`):** An interface defining the structure of a tool's
  execution outcome:
  - `llmContent`: The factual content to be included in the history sent back to
    the LLM for context. This can be a simple string or a `PartListUnion` (an
    array of `Part` objects and strings) for rich content.
  - `returnDisplay`: A user-friendly string (often Markdown) or a special object
    (like `FileDiff`) for display in the CLI.

- **Returning rich content:** Tools are not limited to returning simple text.
  The `llmContent` can be a `PartListUnion`, which is an array that can contain
  a mix of `Part` objects (for images, audio, etc.) and `string`s. This allows a
  single tool execution to return multiple pieces of rich content.

- **Tool registry (`tool-registry.ts`):** A class (`ToolRegistry`) responsible
  for:
  - **Registering tools:** Holding a collection of all available built-in tools
    (e.g., `ReadFileTool`, `ShellTool`).
  - **Discovering tools:** It can also discover tools ...
[Truncated]

### ## Extending with custom tools
While direct programmatic registration of new tools by users isn't explicitly
detailed as a primary workflow in the provided files for typical end-users, the
architecture supports extension through:

- **Command-based discovery:** Advanced users or project administrators can
  define a `tools.discoveryCommand` in `settings.json`. This command, when run
  by the Gemini CLI core, should output a JSON array of `FunctionDeclaration`
  objects. The core will then make these available as `DiscoveredTool`
  instances. The corresponding `tools.callCommand` would then be responsible for
  actually executing these custom tools.
- **MCP server(s):** For more complex scenarios, one or more MCP servers can be
  set up and configured via the `mcpServers` setting in `settings.json`. The
  Gemini CLI core can then discover and use tools exposed by these servers. As
  mentioned, if you have multiple MCP servers, the tool names will be prefixed
  with the server name from your configuration (e.g.,
  `serverAlias__actualToolName`).

This tool system provides a flexible and powerful way to augment the Gemini
model's capabilities, making the Gemini CLI a versatile assistant for a wide
range of tasks.

### ## Common error messages and solutions
- **Error: `EADDRINUSE` (Address already in use) when starting an MCP server.**
  - **Cause:** Another process is already using the port that the MCP server is
    trying to bind to.
  - **Solution:** Either stop the other process that is using the port or
    configure the MCP server to use a different port.

- **Error: Command not found (when attempting to run Gemini CLI with
  `gemini`).**
  - **Cause:** Gemini CLI is not correctly installed or it is not in your
    system's `PATH`.
  - **Solution:** The update depends on how you installed Gemini CLI:
    - If you installed `gemini` globally, check that your `npm` global binary
      directory is in your `PATH`. You can update Gemini CLI using the command
      `npm install -g @google/gemini-cli@latest`.
    - If you are running `gemini` from source, ensure you are using the correct
      command to invoke it (e.g., `node packages/cli/dist/index.js ...`). To
      update Gemini CLI, pull the latest changes from the repository, and then
      rebuild using the command `npm run build`.

- **Error: `MODULE_NOT_FOUND` or import errors.**
  - **Cause:** Dependencies are not installed correctly, or the project hasn't
    been built.
  - **Solution:**
    1.  Run `npm install` to ensure all dependencies are present.
    2.  Run `npm run build` to compile the project.
    3.  Verify that the build completed successfully with `npm run start`.

- **Error: "Operation not permitted", "Permission denied", or similar.**
  - **Cause:** When sandboxing is enabled, Gemini CLI may attempt operations
    that are restricted by your sandbox configuration, such as writing outside
    the project directory or system temp directory.
  - **Solution:** Refer to the [Configuration: Sandboxing](../cli/sandbox.md)
    documentation for more information, including how to customize your sandbox
    configuration.

- **Gemini CLI is not running in interactive mode in "CI" environments**
  - **Issue:** The Gemini CLI does not enter interactive ...
[Truncated]

### # Activate skill tool (`activate_skill`)
The `activate_skill` tool lets Gemini CLI load specialized procedural expertise
and resources when they are relevant to your request.

### ## Description
Skills are packages of instructions and tools designed for specific engineering
tasks, such as reviewing code or creating pull requests. Gemini CLI uses this
tool to "activate" a skill, which provides it with detailed guidelines and
specialized tools tailored to that task.

### ### Arguments
`activate_skill` takes one argument:

- `name` (enum, required): The name of the skill to activate (for example,
  `code-reviewer`, `pr-creator`, or `docs-writer`).

### ## Usage
The `activate_skill` tool is used exclusively by the Gemini agent. You cannot
invoke this tool manually.

When the agent identifies that a task matches a discovered skill, it requests to
activate that skill. Once activated, the agent's behavior is guided by the
skill's specific instructions until the task is complete.

### ## Behavior
The agent uses this tool to provide professional-grade assistance:

- **Specialized logic:** Skills contain expert-level procedures for complex
  workflows.
- **Dynamic capability:** Activating a skill can grant the agent access to new,
  task-specific tools.
- **Contextual awareness:** Skills help the agent focus on the most relevant
  standards and conventions for a particular task.

### ## Next steps
- Learn how to [Use Agent Skills](../cli/skills.md).
- See the [Creating Agent Skills](../cli/creating-skills.md) guide.

### ### Agent coordination
These tools help the model manage its plan and interact with you.

- **Ask user (`ask_user`):** Requests clarification or missing information from
  you via an interactive dialog.
- **[Memory](./memory.md) (`save_memory`):** Saves important facts to your
  long-term memory (`GEMINI.md`).
- **[Todos](./todos.md) (`write_todos`):** Manages a list of subtasks for
  complex plans.
- **[Agent Skills](../cli/skills.md) (`activate_skill`):** Loads specialized
  procedural expertise when needed.
- **Internal docs (`get_internal_docs`):** Accesses Gemini CLI's own
  documentation to help answer your questions.

### # MCP servers with the Gemini CLI
This document provides a guide to configuring and using Model Context Protocol
(MCP) servers with the Gemini CLI.

### ## What is an MCP server?
An MCP server is an application that exposes tools and resources to the Gemini
CLI through the Model Context Protocol, allowing it to interact with external
systems and data sources. MCP servers act as a bridge between the Gemini model
and your local environment or other services like APIs.

An MCP server enables the Gemini CLI to:

- **Discover tools:** List available tools, their descriptions, and parameters
  through standardized schema definitions.
- **Execute tools:** Call specific tools with defined arguments and receive
  structured responses.
- **Access resources:** Read data from specific resources that the server
  exposes (files, API payloads, reports, etc.).

With an MCP server, you can extend the Gemini CLI's capabilities to perform
actions beyond its built-in features, such as interacting with databases, APIs,
custom scripts, or specialized workflows.

### ## Core integration architecture
The Gemini CLI integrates with MCP servers through a sophisticated discovery and
execution system built into the core package (`packages/core/src/tools/`):

### ### Discovery Layer (`mcp-client.ts`)
The discovery process is orchestrated by `discoverMcpTools()`, which:

1. **Iterates through configured servers** from your `settings.json`
   `mcpServers` configuration
2. **Establishes connections** using appropriate transport mechanisms (Stdio,
   SSE, or Streamable HTTP)
3. **Fetches tool definitions** from each server using the MCP protocol
4. **Sanitizes and validates** tool schemas for compatibility with the Gemini
   API
5. **Registers tools** in the global tool registry with conflict resolution
6. **Fetches and registers resources** if the server exposes any

### ### Execution layer (`mcp-tool.ts`)
Each discovered MCP tool is wrapped in a `DiscoveredMCPTool` instance that:

- **Handles confirmation logic** based on server trust settings and user
  preferences
- **Manages tool execution** by calling the MCP server with proper parameters
- **Processes responses** for both the LLM context and user display
- **Maintains connection state** and handles timeouts

### ### Transport mechanisms
The Gemini CLI supports three MCP transport types:

- **Stdio Transport:** Spawns a subprocess and communicates via stdin/stdout
- **SSE Transport:** Connects to Server-Sent Events endpoints
- **Streamable HTTP Transport:** Uses HTTP streaming for communication

### ## Working with MCP resources
Some MCP servers expose contextual “resources” in addition to the tools and
prompts. Gemini CLI discovers these automatically and gives you the possibility
to reference them in the chat.

### ### Discovery and listing
- When discovery runs, the CLI fetches each server’s `resources/list` results.
- The `/mcp` command displays a Resources section alongside Tools and Prompts
  for every connected server.

This returns a concise, plain-text list of URIs plus metadata.

### ## How to set up your MCP server
The Gemini CLI uses the `mcpServers` configuration in your `settings.json` file
to locate and connect to MCP servers. This configuration supports multiple
servers with different transport mechanisms.

### ### Configure the MCP server in settings.json
You can configure MCP servers in your `settings.json` file in two main ways:
through the top-level `mcpServers` object for specific server definitions, and
through the `mcp` object for global settings that control server discovery and
execution.

### #### Global MCP settings (`mcp`)
The `mcp` object in your `settings.json` lets you define global rules for all
MCP servers.

- **`mcp.serverCommand`** (string): A global command to start an MCP server.
- **`mcp.allowed`** (array of strings): A list of MCP server names to allow. If
  this is set, only servers from this list (matching the keys in the
  `mcpServers` object) will be connected to.
- **`mcp.excluded`** (array of strings): A list of MCP server names to exclude.
  Servers in this list will not be connected to.

**Example:**

```json
{
  "mcp": {
    "allowed": ["my-trusted-server"],
    "excluded": ["experimental-server"]
  }
}
```

### #### Server-specific configuration (`mcpServers`)
The `mcpServers` object is where you define each individual MCP server you want
the CLI to connect to.

### ### Configuration structure
Add an `mcpServers` object to your `settings.json` file:

```json
{ ...file contains other config objects
  "mcpServers": {
    "serverName": {
      "command": "path/to/server",
      "args": ["--arg1", "value1"],
      "env": {
        "API_KEY": "$MY_API_TOKEN"
      },
      "cwd": "./server-directory",
      "timeout": 30000,
      "trust": false
    }
  }
}
```

### #### Optional
- **`args`** (string[]): Command-line arguments for Stdio transport
- **`headers`** (object): Custom HTTP headers when using `url` or `httpUrl`
- **`env`** (object): Environment variables for the server process. Values can
  reference environment variables using `$VAR_NAME` or `${VAR_NAME}` syntax
- **`cwd`** (string): Working directory for Stdio transport
- **`timeout`** (number): Request timeout in milliseconds (default: 600,000ms =
  10 minutes)
- **`trust`** (boolean): When `true`, bypasses all tool call confirmations for
  this server (default: `false`)
- **`includeTools`** (string[]): List of tool names to include from this MCP
  server. When specified, only the tools listed here will be available from this
  server (allowlist behavior). If not specified, all tools from the server are
  enabled by default.
- **`excludeTools`** (string[]): List of tool names to exclude from this MCP
  server. Tools listed here will not be available to the model, even if they are
  exposed by the server. **Note:** `excludeTools` takes precedence over
  `includeTools` - if a tool is in both lists, it will be excluded.
- **`targetAudience`** (string): The OAuth Client ID allowlisted on the
  IAP-protected application you are trying to access. Used with
  `authProviderType: 'service_account_impersonation'`.
- **`targetServiceAccount`** (string): The email address of the Google Cloud
  Service Account to impersonate. Used with
  `authProviderType: 'service_account_impersonation'`.

### ### OAuth support for remote MCP servers
The Gemini CLI supports OAuth 2.0 authentication for remote MCP servers using
SSE or HTTP transports. This enables secure access to MCP servers that require
authentication.

### #### Automatic OAuth discovery
For servers that support OAuth discovery, you can omit the OAuth configuration
and let the CLI discover it automatically:

```json
{
  "mcpServers": {
    "discoveredServer": {
      "url": "https://api.example.com/sse"
    }
  }
}
```

The CLI will automatically:

- Detect when a server requires OAuth authentication (401 responses)
- Discover OAuth endpoints from server metadata
- Perform dynamic client registration if supported
- Handle the OAuth flow and token management

### #### Managing OAuth authentication
Use the `/mcp auth` command to manage OAuth authentication:

```bash

### # List servers requiring authentication
/mcp auth

### # Authenticate with a specific server
/mcp auth serverName

### # Re-authenticate if tokens expire
/mcp auth serverName
```

### #### Token management
OAuth tokens are automatically:

- **Stored securely** in `~/.gemini/mcp-oauth-tokens.json`
- **Refreshed** when expired (if refresh tokens are available)
- **Validated** before each connection attempt
- **Cleaned up** when invalid or expired

### #### Google credentials
```json
{
  "mcpServers": {
    "googleCloudServer": {
      "httpUrl": "https://my-gcp-service.run.app/mcp",
      "authProviderType": "google_credentials",
      "oauth": {
        "scopes": ["https://www.googleapis.com/auth/userinfo.email"]
      }
    }
  }
}
```

### #### Service account impersonation
To authenticate with a server using Service Account Impersonation, you must set
the `authProviderType` to `service_account_impersonation` and provide the
following properties:

- **`targetAudience`** (string): The OAuth Client ID allowslisted on the
  IAP-protected application you are trying to access.
- **`targetServiceAccount`** (string): The email address of the Google Cloud
  Service Account to impersonate.

The CLI will use your local Application Default Credentials (ADC) to generate an
OIDC ID token for the specified service account and audience. This token will
then be used to authenticate with the MCP server.

### #### Setup instructions
1. **[Create](https://cloud.google.com/iap/docs/oauth-client-creation) or use an
   existing OAuth 2.0 client ID.** To use an existing OAuth 2.0 client ID,
   follow the steps in
   [How to share OAuth Clients](https://cloud.google.com/iap/docs/sharing-oauth-clients).
2. **Add the OAuth ID to the allowlist for
   [programmatic access](https://cloud.google.com/iap/docs/sharing-oauth-clients#programmatic_access)
   for the application.** Since Cloud Run is not yet a supported resource type
   in gcloud iap, you must allowlist the Client ID on the project.
3. **Create a service account.**
   [Documentation](https://cloud.google.com/iam/docs/service-accounts-create#creating),
   [Cloud Console Link](https://console.cloud.google.com/iam-admin/serviceaccounts)
4. **Add both the service account and users to the IAP Policy** in the
   "Security" tab of the Cloud Run service itself or via gcloud.
5. **Grant all users and groups** who will access the MCP Server the necessary
   permissions to
   [impersonate the service account](https://cloud.google.com/docs/authentication/use-service-account-impersonation)
   (i.e., `roles/iam.serviceAccountTokenCreator`).
6. **[Enable](https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com)
   the IAM Credentials API** for your project.

### #### Python MCP server (stdio)
```json
{
  "mcpServers": {
    "pythonTools": {
      "command": "python",
      "args": ["-m", "my_mcp_server", "--port", "8080"],
      "cwd": "./mcp-servers/python",
      "env": {
        "DATABASE_URL": "$DB_CONNECTION_STRING",
        "API_KEY": "${EXTERNAL_API_KEY}"
      },
      "timeout": 15000
    }
  }
}
```

### #### Node.js MCP server (stdio)
```json
{
  "mcpServers": {
    "nodeServer": {
      "command": "node",
      "args": ["dist/server.js", "--verbose"],
      "cwd": "./mcp-servers/node",
      "trust": true
    }
  }
}
```

### #### Docker-based MCP server
```json
{
  "mcpServers": {
    "dockerizedServer": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "API_KEY",
        "-v",
        "${PWD}:/workspace",
        "my-mcp-server:latest"
      ],
      "env": {
        "API_KEY": "$EXTERNAL_SERVICE_TOKEN"
      }
    }
  }
}
```

### #### HTTP-based MCP server
```json
{
  "mcpServers": {
    "httpServer": {
      "httpUrl": "http://localhost:3000/mcp",
      "timeout": 5000
    }
  }
}
```

### #### HTTP-based MCP Server with custom headers
```json
{
  "mcpServers": {
    "httpServerWithAuth": {
      "httpUrl": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer your-api-token",
        "X-Custom-Header": "custom-value",
        "Content-Type": "application/json"
      },
      "timeout": 5000
    }
  }
}
```

### #### MCP server with tool filtering
```json
{
  "mcpServers": {
    "filteredServer": {
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "includeTools": ["safe_tool", "file_reader", "data_processor"],
      // "excludeTools": ["dangerous_tool", "file_deleter"],
      "timeout": 30000
    }
  }
}
```

### ### SSE MCP server with SA impersonation
```json
{
  "mcpServers": {
    "myIapProtectedServer": {
      "url": "https://my-iap-service.run.app/sse",
      "authProviderType": "service_account_impersonation",
      "targetAudience": "YOUR_IAP_CLIENT_ID.apps.googleusercontent.com",
      "targetServiceAccount": "your-sa@your-project.iam.gserviceaccount.com"
    }
  }
}
```

### ## Discovery process deep dive
When the Gemini CLI starts, it performs MCP server discovery through the
following detailed process:

### ### 1. Server iteration and connection
For each configured server in `mcpServers`:

1. **Status tracking begins:** Server status is set to `CONNECTING`
2. **Transport selection:** Based on configuration properties:
   - `httpUrl` → `StreamableHTTPClientTransport`
   - `url` → `SSEClientTransport`
   - `command` → `StdioClientTransport`
3. **Connection establishment:** The MCP client attempts to connect with the
   configured timeout
4. **Error handling:** Connection failures are logged and the server status is
   set to `DISCONNECTED`

### ### 2. Tool discovery
Upon successful connection:

1. **Tool listing:** The client calls the MCP server's tool listing endpoint
2. **Schema validation:** Each tool's function declaration is validated
3. **Tool filtering:** Tools are filtered based on `includeTools` and
   `excludeTools` configuration
4. **Name sanitization:** Tool names are cleaned to meet Gemini API
   requirements:
   - Invalid characters (non-alphanumeric, underscore, dot, hyphen) are replaced
     with underscores
   - Names longer than 63 characters are truncated with middle replacement
     (`___`)

### ### 5. Connection management
After discovery:

- **Persistent connections:** Servers that successfully register tools maintain
  their connections
- **Cleanup:** Servers that provide no usable tools have their connections
  closed
- **Status updates:** Final server statuses are set to `CONNECTED` or
  `DISCONNECTED`

### ## Tool execution flow
When the Gemini model decides to use an MCP tool, the following execution flow
occurs:

### ### 2. Confirmation process
Each `DiscoveredMCPTool` implements sophisticated confirmation logic:

### ### 3. Execution
Upon confirmation (or trust bypass):

1. **Parameter preparation:** Arguments are validated against the tool's schema
2. **MCP call:** The underlying `CallableTool` invokes the server with:

   ```typescript
   const functionCalls = [
     {
       name: this.serverToolName, // Original server tool name
       args: params,
     },
   ];
   ```

3. **Response processing:** Results are formatted for both LLM context and user
   display

### ## How to interact with your MCP server


### ### Using the `/mcp` command
The `/mcp` command provides comprehensive information about your MCP server
setup:

```bash
/mcp
```

This displays:

- **Server list:** All configured MCP servers
- **Connection status:** `CONNECTED`, `CONNECTING`, or `DISCONNECTED`
- **Server details:** Configuration summary (excluding sensitive data)
- **Available tools:** List of tools from each server with descriptions
- **Discovery state:** Overall discovery process status

### ### Example `/mcp` output
```
MCP Servers Status:

📡 pythonTools (CONNECTED)
  Command: python -m my_mcp_server --port 8080
  Working Directory: ./mcp-servers/python
  Timeout: 15000ms
  Tools: calculate_sum, file_analyzer, data_processor

🔌 nodeServer (DISCONNECTED)
  Command: node dist/server.js --verbose
  Error: Connection refused

🐳 dockerizedServer (CONNECTED)
  Command: docker run -i --rm -e API_KEY my-mcp-server:latest
  Tools: docker__deploy, docker__status

Discovery State: COMPLETED
```

### ### Tool usage
Once discovered, MCP tools are available to the Gemini model like built-in
tools. The model will automatically:

1. **Select appropriate tools** based on your requests
2. **Present confirmation dialogs** (unless the server is trusted)
3. **Execute tools** with proper parameters
4. **Display results** in a user-friendly format

### ### Connection states
The MCP integration tracks several states:

### #### Server status (`MCPServerStatus`)
- **`DISCONNECTED`:** Server is not connected or has errors
- **`CONNECTING`:** Connection attempt in progress
- **`CONNECTED`:** Server is connected and ready

### #### Discovery state (`MCPDiscoveryState`)
- **`NOT_STARTED`:** Discovery hasn't begun
- **`IN_PROGRESS`:** Currently discovering servers
- **`COMPLETED`:** Discovery finished (with or without errors)

### #### Server won't connect
**Symptoms:** Server shows `DISCONNECTED` status

**Troubleshooting:**

1. **Check configuration:** Verify `command`, `args`, and `cwd` are correct
2. **Test manually:** Run the server command directly to ensure it works
3. **Check dependencies:** Ensure all required packages are installed
4. **Review logs:** Look for error messages in the CLI output
5. **Verify permissions:** Ensure the CLI can execute the server command

### #### No tools discovered
**Symptoms:** Server connects but no tools are available

**Troubleshooting:**

1. **Verify tool registration:** Ensure your server actually registers tools
2. **Check MCP protocol:** Confirm your server implements the MCP tool listing
   correctly
3. **Review server logs:** Check stderr output for server-side errors
4. **Test tool listing:** Manually test your server's tool discovery endpoint

### #### Sandbox compatibility
**Symptoms:** MCP servers fail when sandboxing is enabled

**Solutions:**

1. **Docker-based servers:** Use Docker containers that include all dependencies
2. **Path accessibility:** Ensure server executables are available in the
   sandbox
3. **Network access:** Configure sandbox to allow necessary network connections
4. **Environment variables:** Verify required environment variables are passed
   through

### ### Debugging tips
1. **Enable debug mode:** Run the CLI with `--debug` for verbose output (use F12
   to open debug console in interactive mode)
2. **Check stderr:** MCP server stderr is captured and logged (INFO messages
   filtered)
3. **Test isolation:** Test your MCP server independently before integrating
4. **Incremental setup:** Start with simple tools before adding complex
   functionality
5. **Use `/mcp` frequently:** Monitor server status during development

### ### Security considerations
- **Trust settings:** The `trust` option bypasses all confirmation dialogs. Use
  cautiously and only for servers you completely control
- **Access tokens:** Be security-aware when configuring environment variables
  containing API keys or tokens
- **Sandbox compatibility:** When using sandboxing, ensure MCP servers are
  available within the sandbox environment
- **Private data:** Using broadly scoped personal access tokens can lead to
  information leakage between repositories.

### ### Performance and resource management
- **Connection persistence:** The CLI maintains persistent connections to
  servers that successfully register tools
- **Automatic cleanup:** Connections to servers providing no tools are
  automatically closed
- **Timeout management:** Configure appropriate timeouts based on your server's
  response characteristics
- **Resource monitoring:** MCP servers run as separate processes and consume
  system resources

### ### Schema compatibility
- **Property stripping:** The system automatically removes certain schema
  properties (`$schema`, `additionalProperties`) for Gemini API compatibility
- **Name sanitization:** Tool names are automatically sanitized to meet API
  requirements
- **Conflict resolution:** Tool name conflicts between servers are resolved
  through automatic prefixing

This comprehensive integration makes MCP servers a powerful way to extend the
Gemini CLI's capabilities while maintaining security, reliability, and ease of
use.

### ## Returning rich content from tools
MCP tools are not limited to returning simple text. You can return rich,
multi-part content, including text, images, audio, and other binary data in a
single tool response. This allows you to build powerful tools that can provide
diverse information to the model in a single turn.

All data returned from the tool is processed and sent to the model as context
for its next generation, enabling it to reason about or summarize the provided
information.

### ### How it works
To return rich content, your tool's response must adhere to the MCP
specification for a
[`CallToolResult`](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result).
The `content` field of the result should be an array of `ContentBlock` objects.
The Gemini CLI will correctly process this array, separating text from binary
data and packaging it for the model.

You can mix and match different content block types in the `content` array. The
supported block types include:

- `text`
- `image`
- `audio`
- `resource` (embedded content)
- `resource_link`

### ### Example: Returning text and an image
Here is an example of a valid JSON response from an MCP tool that returns both a
text description and an image:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Here is the logo you requested."
    },
    {
      "type": "image",
      "data": "BASE64_ENCODED_IMAGE_DATA_HERE",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "The logo was created in 2025."
    }
  ]
}
```

When the Gemini CLI receives this response, it will:

1.  Extract all the text and combine it into a single `functionResponse` part
    for the model.
2.  Present the image data as a separate `inlineData` part.
3.  Provide a clean, user-friendly summary in the CLI, indicating that both text
    and an image were received.

This enables you to build sophisticated tools that can provide rich, multi-modal
context to the Gemini model.

### ## MCP prompts as slash commands
In addition to tools, MCP servers can expose predefined prompts that can be
executed as slash commands within the Gemini CLI. This allows you to create
shortcuts for common or complex queries that can be easily invoked by name.

### ### Defining prompts on the server
Here's a small example of a stdio MCP server that defines prompts:

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'prompt-server',
  version: '1.0.0',
});

server.registerPrompt(
  'poem-writer',
  {
    title: 'Poem Writer',
    description: 'Write a nice haiku',
    argsSchema: { title: z.string(), mood: z.string().optional() },
  },
  ({ title, mood }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Write a haiku${mood ? ` with the mood ${mood}` : ''} called ${title}. Note that a haiku is 5 syllables followed by 7 syllables followed by 5 syllables `,
        },
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

This can be included in `settings.json` under `mcpServers` with:

```json
{
  "mcpServers": {
    "nodeServer": {
      "command": "node",
      "args": ["filename.ts"]
    }
  }
}
```

### ### Invoking prompts
Once a prompt is discovered, you can invoke it using its name as a slash
command. The CLI will automatically handle parsing arguments.

```bash
/poem-writer --title="Gemini CLI" --mood="reverent"
```

or, using positional arguments:

```bash
/poem-writer "Gemini CLI" reverent
```

When you run this command, the Gemini CLI executes the `prompts/get` method on
the MCP server with the provided arguments. The server is responsible for
substituting the arguments into the prompt template and returning the final
prompt text. The CLI then sends this prompt to the model for execution. This
provides a convenient way to automate and share common workflows.

### ## Managing MCP servers with `gemini mcp`
While you can always configure MCP servers by manually editing your
`settings.json` file, the Gemini CLI provides a convenient set of commands to
manage your server configurations programmatically. These commands streamline
the process of adding, listing, and removing MCP servers without needing to
directly edit JSON files.

### ### Adding a server (`gemini mcp add`)
The `add` command configures a new MCP server in your `settings.json`. Based on
the scope (`-s, --scope`), it will be added to either the user config
`~/.gemini/settings.json` or the project config `.gemini/settings.json` file.

**Command:**

```bash
gemini mcp add [options] <name> <commandOrUrl> [args...]
```

- `<name>`: A unique name for the server.
- `<commandOrUrl>`: The command to execute (for `stdio`) or the URL (for
  `http`/`sse`).
- `[args...]`: Optional arguments for a `stdio` command.

**Options (flags):**

- `-s, --scope`: Configuration scope (user or project). [default: "project"]
- `-t, --transport`: Transport type (stdio, sse, http). [default: "stdio"]
- `-e, --env`: Set environment variables (e.g. -e KEY=value).
- `-H, --header`: Set HTTP headers for SSE and HTTP transports (e.g. -H
  "X-Api-Key: abc123" -H "Authorization: Bearer abc123").
- `--timeout`: Set connection timeout in milliseconds.
- `--trust`: Trust the server (bypass all tool call confirmation prompts).
- `--description`: Set the description for the server.
- `--include-tools`: A comma-separated list of tools to include.
- `--exclude-tools`: A comma-separated list of tools to exclude.

### #### Adding an stdio server
This is the default transport for running local servers.

```bash

### # Basic syntax
gemini mcp add [options] <name> <command> [args...]

### # Example: Adding a local server
gemini mcp add -e API_KEY=123 -e DEBUG=true my-stdio-server /path/to/server arg1 arg2 arg3

### # Example: Adding a local python server
gemini mcp add python-server python server.py -- --server-arg my-value
```

### #### Adding an HTTP server
This transport is for servers that use the streamable HTTP transport.

```bash

### # Basic syntax
gemini mcp add --transport http <name> <url>

### # Example: Adding an HTTP server
gemini mcp add --transport http http-server https://api.example.com/mcp/

### # Example: Adding an HTTP server with an authentication header
gemini mcp add --transport http --header "Authorization: Bearer abc123" secure-http https://api.example.com/mcp/
```

### #### Adding an SSE server
This transport is for servers that use Server-Sent Events (SSE).

```bash

### # Basic syntax
gemini mcp add --transport sse <name> <url>

### # Example: Adding an SSE server
gemini mcp add --transport sse sse-server https://api.example.com/sse/

### # Example: Adding an SSE server with an authentication header
gemini mcp add --transport sse --header "Authorization: Bearer abc123" secure-sse https://api.example.com/sse/
```

### ### Listing servers (`gemini mcp list`)
To view all MCP servers currently configured, use the `list` command. It
displays each server's name, configuration details, and connection status. This
command has no flags.

**Command:**

```bash
gemini mcp list
```

**Example output:**

```sh
✓ stdio-server: command: python3 server.py (stdio) - Connected
✓ http-server: https://api.example.com/mcp (http) - Connected
✗ sse-server: https://api.example.com/sse (sse) - Disconnected
```

### ### Removing a server (`gemini mcp remove`)
To delete a server from your configuration, use the `remove` command with the
server's name.

**Command:**

```bash
gemini mcp remove <name>
```

**Options (flags):**

- `-s, --scope`: Configuration scope (user or project). [default: "project"]

**Example:**

```bash
gemini mcp remove my-server
```

This will find and delete the "my-server" entry from the `mcpServers` object in
the appropriate `settings.json` file based on the scope (`-s, --scope`).

### ### Enabling/disabling a server (`gemini mcp enable`, `gemini mcp disable`)
Temporarily disable an MCP server without removing its configuration, or
re-enable a previously disabled server.

**Commands:**

```bash
gemini mcp enable <name> [--session]
gemini mcp disable <name> [--session]
```

**Options (flags):**

- `--session`: Apply change only for this session (not persisted to file).

Disabled servers appear in `/mcp` status as "Disabled" but won't connect or
provide tools. Enablement state is stored in
`~/.gemini/mcp-server-enablement.json`.

The same commands are available as slash commands during an active session:
`/mcp enable <name>` and `/mcp disable <name>`.

### ## Instructions
Gemini CLI supports
[MCP server instructions](https://modelcontextprotocol.io/specification/2025-06-18/schema#initializeresult),
which will be appended to the system instructions.

### ## 🚀 Why Gemini CLI?
- **🎯 Free tier**: 60 requests/min and 1,000 requests/day with personal Google
  account.
- **🧠 Powerful Gemini 3 models**: Access to improved reasoning and 1M token
  context window.
- **🔧 Built-in tools**: Google Search grounding, file operations, shell
  commands, web fetching.
- **🔌 Extensible**: MCP (Model Context Protocol) support for custom
  integrations.
- **💻 Terminal-first**: Designed for developers who live in the command line.
- **🛡️ Open source**: Apache 2.0 licensed.

### ### Automation & Integration
- Automate operational tasks like querying pull requests or handling complex
  rebases
- Use MCP servers to connect new capabilities, including
  [media generation with Imagen, Veo or Lyria](https://github.com/GoogleCloudPlatform/vertex-ai-creative-studio/tree/main/experiments/mcp-genmedia)
- Run non-interactively in scripts for workflow automation

### ### Tools & Extensions
- [**Built-in Tools Overview**](./docs/tools/index.md)
  - [File System Operations](./docs/tools/file-system.md)
  - [Shell Commands](./docs/tools/shell.md)
  - [Web Fetch & Search](./docs/tools/web-fetch.md)
- [**MCP Server Integration**](./docs/tools/mcp-server.md) - Extend with custom
  tools.
- [**Custom Extensions**](./docs/extensions/index.md) - Build and share your own
  commands.

### ### Using MCP Servers
Configure MCP servers in `~/.gemini/settings.json` to extend Gemini CLI with
custom tools:

```text
> @github List my open pull requests
> @slack Send a summary of today's commits to #dev channel
> @database Run a query to find inactive users
```

See the [MCP Server Integration guide](./docs/tools/mcp-server.md) for setup
instructions.

### ## 🤝 Contributing
We welcome contributions! Gemini CLI is fully open source (Apache 2.0), and we
encourage the community to:

- Report bugs and suggest features.
- Improve documentation.
- Submit code improvements.
- Share your MCP servers and extensions.

See our [Contributing Guide](./CONTRIBUTING.md) for development setup, coding
standards, and how to submit pull requests.

Check our [Official Roadmap](https://github.com/orgs/google-gemini/projects/11)
for planned features and priorities.

## codex_cli
### ## App-server API Development Best Practices
These guidelines apply to app-server protocol work in `codex-rs`, especially:

- `app-server-protocol/src/protocol/common.rs`
- `app-server-protocol/src/protocol/v2.rs`
- `app-server/README.md`

### ### Client->server request payloads (`*Params`)
- Every optional field must be annotated with `#[ts(optional = nullable)]`. Do not use `#[ts(optional = nullable)]` outside client->server request payloads (`*Params`).
- Optional collection fields (for example `Vec`, `HashMap`) must use `Option<...>` + `#[ts(optional = nullable)]`. Do not use `#[serde(default)]` to model optional collections, and do not use `skip_serializing_if` on v2 payload fields.
- When you want omission to mean `false` for boolean fields, use `#[serde(default, skip_serializing_if = "std::ops::Not::not")] pub field: bool` over `Option<bool>`.
- For new list methods, implement cursor pagination by default:
  request fields `pub cursor: Option<String>` and `pub limit: Option<u32>`,
  response fields `pub data: Vec<...>` and `pub next_cursor: Option<String>`.

### # App Server Test Client
Quickstart for running and hitting `codex app-server`.

### # 2) Start websocket app-server in background
cargo run -p codex-app-server-test-client -- \
  --codex-bin ./target/debug/codex \
  serve --listen ws://127.0.0.1:4222 --kill

### # 3) Call app-server (defaults to ws://127.0.0.1:4222)
cargo run -p codex-app-server-test-client -- model-list
```

### # codex-app-server
`codex app-server` is the interface Codex uses to power rich interfaces such as the [Codex VS Code extension](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt).

### ## Table of Contents
- [Protocol](#protocol)
- [Message Schema](#message-schema)
- [Core Primitives](#core-primitives)
- [Lifecycle Overview](#lifecycle-overview)
- [Initialization](#initialization)
- [API Overview](#api-overview)
- [Events](#events)
- [Approvals](#approvals)
- [Skills](#skills)
- [Apps](#apps)
- [Auth endpoints](#auth-endpoints)
- [Experimental API Opt-in](#experimental-api-opt-in)

### ## Protocol
Similar to [MCP](https://modelcontextprotocol.io/), `codex app-server` supports bidirectional communication using JSON-RPC 2.0 messages (with the `"jsonrpc":"2.0"` header omitted on the wire).

Supported transports:

- stdio (`--listen stdio://`, default): newline-delimited JSON (JSONL)
- websocket (`--listen ws://IP:PORT`): one JSON-RPC message per websocket text frame (**experimental / unsupported**)

Websocket transport is currently experimental and unsupported. Do not rely on it for production workloads.

Backpressure behavior:

- The server uses bounded queues between transport ingress, request processing, and outbound writes.
- When request ingress is saturated, new requests are rejected with a JSON-RPC error code `-32001` and message `"Server overloaded; retry later."`.
- Clients should treat this as retryable and use exponential backoff with jitter.

### ## API Overview
- `thread/start` — create a new thread; emits `thread/started` and auto-subscribes you to turn/item events for that thread.
- `thread/resume` — reopen an existing thread by id so subsequent `turn/start` calls append to it.
- `thread/fork` — fork an existing thread into a new thread id by copying the stored history; emits `thread/started` and auto-subscribes you to turn/item events for the new thread.
- `thread/list` — page through stored rollouts; supports cursor-based pagination and optional `modelProviders`, `sourceKinds`, `archived`, and `cwd` filters. Each returned `thread` includes `status` (`ThreadStatus`), defaulting to `notLoaded` when the thread is not currently loaded.
- `thread/loaded/list` — list the thread ids currently loaded in memory.
- `thread/read` — read a stored thread by id without resuming it; optionally include turns via `includeTurns`. The returned `thread` includes `status` (`ThreadStatus`), defaulting to `notLoaded` when the thread is not currently loaded.
- `thread/status/changed` — notification emitted when a loaded thread’s status changes (`threadId` + new `status`).
- `thread/archive` — move a thread’s rollout file into the archived directory; returns `{}` on success and emits `thread/archived`.
- `thread/name/set` — set or update a thread’s user-facing name; returns `{}` on success. Thread names are not required to be unique; name lookups resolve to the most recently updated thread.
- `thread/unarchive` — move an archived rollout file back into the sessions directory; returns the restored `thread` on success and emits `thread/unarchived`.
- `thread/compact/start` — trigger conversation history compaction for a thread; returns `{}` immediately while progress streams through standard turn/item notifications.
- `thread/backgroundTerminals/clean` — terminate all running background terminals for a thread (experimental; requires `capabilities.experimentalApi`); returns `{}` when the cleanup request is accepted.
- `thread/rollback` — drop the...
[Truncated]

### ### Example: Start a turn (invoke a skill)
Invoke a skill explicitly by including `$<skill-name>` in the text input and adding a `skill` input item alongside it.

```json
{ "method": "turn/start", "id": 33, "params": {
    "threadId": "thr_123",
    "input": [
        { "type": "text", "text": "$skill-creator Add a new skill for triaging flaky CI and include step-by-step usage." },
        { "type": "skill", "name": "skill-creator", "path": "/Users/me/.codex/skills/skill-creator/SKILL.md" }
    ]
} }
{ "id": 33, "result": { "turn": {
    "id": "turn_457",
    "status": "inProgress",
    "items": [],
    "error": null
} } }
```

### #### Items
`ThreadItem` is the tagged union carried in turn responses and `item/*` notifications. Currently we support events for the following items:

- `userMessage` — `{id, content}` where `content` is a list of user inputs (`text`, `image`, or `localImage`).
- `agentMessage` — `{id, text}` containing the accumulated agent reply.
- `plan` — `{id, text}` emitted for plan-mode turns; plan text can stream via `item/plan/delta` (experimental).
- `reasoning` — `{id, summary, content}` where `summary` holds streamed reasoning summaries (applicable for most OpenAI models) and `content` holds raw reasoning blocks (applicable for e.g. open source models).
- `commandExecution` — `{id, command, cwd, status, commandActions, aggregatedOutput?, exitCode?, durationMs?}` for sandboxed commands; `status` is `inProgress`, `completed`, `failed`, or `declined`.
- `fileChange` — `{id, changes, status}` describing proposed edits; `changes` list `{path, kind, diff}` and `status` is `inProgress`, `completed`, `failed`, or `declined`.
- `mcpToolCall` — `{id, server, tool, status, arguments, result?, error?}` describing MCP calls; `status` is `inProgress`, `completed`, or `failed`.
- `collabToolCall` — `{id, tool, status, senderThreadId, receiverThreadId?, newThreadId?, prompt?, agentStatus?}` describing collab tool calls (`spawn_agent`, `send_input`, `resume_agent`, `wait`, `close_agent`); `status` is `inProgress`, `completed`, or `failed`.
- `webSearch` — `{id, query, action?}` for a web search request issued by the agent; `action` mirrors the Responses API web_search action payload (`search`, `open_page`, `find_in_page`) and may be omitted until completion.
- `imageView` — `{id, path}` emitted when the agent invokes the image viewer tool.
- `enteredReviewMode` — `{id, review}` sent when the reviewer starts; `review` is a short user-facing label such as `"current changes"` or the requested target description.
- `exitedReviewMode` — `{id, review}` emitted when the reviewer finishes; `review` is the...
[Truncated]

### ## Skills
Invoke a skill by including `$<skill-name>` in the text input. Add a `skill` input item (recommended) so the backend injects full skill instructions instead of relying on the model to resolve the name.

```json
{
  "method": "turn/start",
  "id": 101,
  "params": {
    "threadId": "thread-1",
    "input": [
      {
        "type": "text",
        "text": "$skill-creator Add a new skill for triaging flaky CI."
      },
      {
        "type": "skill",
        "name": "skill-creator",
        "path": "/Users/me/.codex/skills/skill-creator/SKILL.md"
      }
    ]
  }
}
```

If you omit the `skill` item, the model will still parse the `$<skill-name>` marker and try to locate the skill, which can add latency.

Example:

```
$skill-creator Add a new skill for triaging flaky CI and include step-by-step usage.
```

Use `skills/list` to fetch the available skills (optionally scoped by `cwds`, with `forceReload`).
You can also add `perCwdExtraUserRoots` to scan additional absolute paths as `user` scope for specific `cwd` entries.
Entries whose `cwd` is not present in `cwds` are ignored.
`skills/list` might reuse a cached skills result per `cwd`; setting `forceReload` to `true` refreshes the result from disk.

```json
{ "method": "skills/list", "id": 25, "params": {
    "cwds": ["/Users/me/project", "/Users/me/other-project"],
    "forceReload": true,
    "perCwdExtraUserRoots": [
      {
        "cwd": "/Users/me/project",
        "extraUserRoots": ["/Users/me/shared-skills"]
      }
    ]
} }
{ "id": 25, "result": {
    "data": [{
        "cwd": "/Users/me/project",
        "skills": [
            {
              "name": "skill-creator",
              "description": "Create or update a Codex skill",
              "enabled": true,
              "interface": {
                "displayName": "Skill Creator",
                "shortDescription": "Create or update a Codex skill",
                "iconSmall": "icon.svg",
                "iconLarge": "icon-large.svg",
              ...
[Truncated]

### ### API Overview
- `account/read` — fetch current account info; optionally refresh tokens.
- `account/login/start` — begin login (`apiKey`, `chatgpt`).
- `account/login/completed` (notify) — emitted when a login attempt finishes (success or error).
- `account/login/cancel` — cancel a pending ChatGPT login by `loginId`.
- `account/logout` — sign out; triggers `account/updated`.
- `account/updated` (notify) — emitted whenever auth mode changes (`authMode`: `apikey`, `chatgpt`, or `null`).
- `account/rateLimits/read` — fetch ChatGPT rate limits; updates arrive via `account/rateLimits/updated` (notify).
- `account/rateLimits/updated` (notify) — emitted whenever a user's ChatGPT rate limits change.
- `mcpServer/oauthLogin/completed` (notify) — emitted after a `mcpServer/oauth/login` flow finishes for a server; payload includes `{ name, success, error? }`.

### # Configuration docs moved
This file has moved. Please see the latest configuration documentation here:

- Full config docs: [docs/config.md](../docs/config.md)
- MCP servers section: [docs/config.md#connecting-to-mcp-servers](../docs/config.md#connecting-to-mcp-servers)
You are GPT-5.1 running in the Codex CLI, a terminal-based coding assistant. Codex CLI is an open source project led by OpenAI. You are expected to be precise, safe, and helpful.

Your capabilities:

- Receive user prompts and other context provided by the harness, such as files in the workspace.
- Communicate with the user by streaming thinking & responses, and by making & updating plans.
- Emit function calls to run terminal commands and apply patches. Depending on how this specific run is configured, you can request that these function calls be escalated to the user for approval before running. More on this in the "Sandbox and approvals" section.

Within this context, Codex refers to the open-source agentic coding interface (not the old Codex language model built by OpenAI).

### ## Full example
```yaml
interface:
  display_name: "Optional user-facing name"
  short_description: "Optional user-facing description"
  icon_small: "./assets/small-400px.png"
  icon_large: "./assets/large-logo.svg"
  brand_color: "#3B82F6"
  default_prompt: "Optional surrounding prompt to use the skill with"

dependencies:
  tools:
    - type: "mcp"
      value: "github"
      description: "GitHub MCP server"
      transport: "streamable_http"
      url: "https://api.githubcopilot.com/mcp/"

policy:
  allow_implicit_invocation: true
```

### ## Field descriptions and constraints
Top-level constraints:

- Quote all string values.
- Keep keys unquoted.
- For `interface.default_prompt`: generate a helpful, short (typically 1 sentence) example starting prompt based on the skill. It must explicitly mention the skill as `$skill-name` (e.g., "Use $skill-name-here to draft a concise weekly status update.").

- `interface.display_name`: Human-facing title shown in UI skill lists and chips.
- `interface.short_description`: Human-facing short UI blurb (25–64 chars) for quick scanning.
- `interface.icon_small`: Path to a small icon asset (relative to skill dir). Default to `./assets/` and place icons in the skill's `assets/` folder.
- `interface.icon_large`: Path to a larger logo asset (relative to skill dir). Default to `./assets/` and place icons in the skill's `assets/` folder.
- `interface.brand_color`: Hex color used for UI accents (e.g., badges).
- `interface.default_prompt`: Default prompt snippet inserted when invoking the skill.
- `dependencies.tools[].type`: Dependency category. Only `mcp` is supported for now.
- `dependencies.tools[].value`: Identifier of the tool or dependency.
- `dependencies.tools[].description`: Human-readable explanation of the dependency.
- `dependencies.tools[].transport`: Connection type when `type` is `mcp`.
- `dependencies.tools[].url`: MCP server URL when `type` is `mcp`.
- `policy.allow_implicit_invocation`: When false, the skill is not injected into
  the model context by default, but can still be invoked explicitly via `$skill`.
  Defaults to true.
---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Codex's capabilities with specialized knowledge, workflows, or tool integrations.
metadata:
  short-description: Create or update a skill
---

### # Skill Creator
This skill provides guidance for creating effective skills.

### ## About Skills
Skills are modular, self-contained folders that extend Codex's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks—they transform Codex from a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can fully possess.

### ### What Skills Provide
1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

### ### Concise is Key
The context window is a public good. Skills share the context window with everything else Codex needs: system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: Codex is already very smart.** Only add context Codex doesn't already have. Challenge each piece of information: "Does Codex really need this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### ### Anatomy of a Skill
Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
├── agents/ (recommended)
│   └── openai.yaml - UI metadata for skill lists and chips
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

### #### SKILL.md (required)
Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains `name` and `description` fields. These are the only fields that Codex reads to determine when the skill gets used, thus it is very important to be clear and comprehensive in describing what the skill is, and when it should be used.
- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the skill triggers (if at all).

### #### Agents metadata (recommended)
- UI-facing metadata for skill lists and chips
- Read references/openai_yaml.md before generating values and follow its descriptions and constraints
- Create: human-facing `display_name`, `short_description`, and `default_prompt` by reading the skill
- Generate deterministically by passing the values as `--interface key=value` to `scripts/generate_openai_yaml.py` or `scripts/init_skill.py`
- On updates: validate `agents/openai.yaml` still matches SKILL.md; regenerate if stale
- Only include other optional interface fields (icons, brand color) if explicitly provided
- See references/openai_yaml.md for field definitions and examples

### ##### References (`references/`)
Documentation and reference material intended to be loaded as needed into context to inform Codex's process and thinking.

- **When to include**: For documentation that Codex should reference while working
- **Examples**: `references/finance.md` for financial schemas, `references/mnda.md` for company NDA template, `references/policies.md` for company policies, `references/api_docs.md` for API specifications
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, detailed workflow guides
- **Benefits**: Keeps SKILL.md lean, loaded only when Codex determines it's needed
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Avoid duplication**: Information should live in either SKILL.md or references files, not both. Prefer references files for detailed information unless it's truly core to the skill—this keeps SKILL.md lean while making information discoverable without hogging the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to references files.

### ##### Assets (`assets/`)
Files not intended to be loaded into context, but rather used within the output Codex produces.

- **When to include**: When the skill needs files that will be used in the final output
- **Examples**: `assets/logo.png` for brand assets, `assets/slides.pptx` for PowerPoint templates, `assets/frontend-template/` for HTML/React boilerplate, `assets/font.ttf` for typography
- **Use cases**: Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified
- **Benefits**: Separates output resources from documentation, enables Codex to use files without loading them into context

### #### What to Not Include in a Skill
A skill should only contain essential files that directly support its functionality. Do NOT create extraneous documentation or auxiliary files, including:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md
- etc.

The skill should only contain the information needed for an AI agent to do the job at hand. It should not contain auxiliary context about the process that went into creating it, setup and testing procedures, user-facing documentation, etc. Creating additional documentation files just adds clutter and confusion.

### ### Progressive Disclosure Design Principle
Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by Codex (Unlimited because scripts can be executed without reading into context window)

### #### Progressive Disclosure Patterns
Keep SKILL.md body to the essentials and under 500 lines to minimize context bloat. Split content into separate files when approaching this limit. When splitting out content into other files, it is very important to reference them from SKILL.md and describe clearly when to read them, to ensure the reader of the skill knows they exist and when to use them.

**Key principle:** When a skill supports multiple variations, frameworks, or options, keep only the core workflow and selection guidance in SKILL.md. Move variant-specific details (patterns, examples, configuration) into separate reference files.

**Pattern 1: High-level guide with references**

```markdown

### ## Advanced features
- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
- **Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
```

Codex loads FORMS.md, REFERENCE.md, or EXAMPLES.md only when needed.

**Pattern 2: Domain-specific organization**

For Skills with multiple domains, organize content by domain to avoid loading irrelevant context:

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

When a user asks about sales metrics, Codex only reads sales.md.

Similarly, for skills supporting multiple frameworks or variants, organize by variant:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md (AWS deployment patterns)
    ├── gcp.md (GCP deployment patterns)
    └── azure.md (Azure deployment patterns)
```

When the user chooses AWS, Codex only reads aws.md.

**Pattern 3: Conditional details**

Show basic content, link to advanced content:

```markdown

### ## Editing documents
For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

Codex reads REDLINING.md or OOXML.md only when the user needs those features.

**Important guidelines:**

- **Avoid deeply nested references** - Keep references one level deep from SKILL.md. All reference files should link directly from SKILL.md.
- **Structure longer reference files** - For files longer than 100 lines, include a table of contents at the top so Codex can see the full scope when previewing.

### ## Skill Creation Process
Skill creation involves these steps:

1. Understand the skill with concrete examples
2. Plan reusable skill contents (scripts, references, assets)
3. Initialize the skill (run init_skill.py)
4. Edit the skill (implement resources and write SKILL.md)
5. Validate the skill (run quick_validate.py)
6. Iterate based on real usage

Follow these steps in order, skipping only if there is a clear reason why they are not applicable.

### ### Skill Naming
- Use lowercase letters, digits, and hyphens only; normalize user-provided titles to hyphen-case (e.g., "Plan Mode" -> `plan-mode`).
- When generating names, generate a name under 64 characters (letters, digits, hyphens).
- Prefer short, verb-led phrases that describe the action.
- Namespace by tool when it improves clarity or triggering (e.g., `gh-address-comments`, `linear-address-issue`).
- Name the skill folder exactly after the skill name.

### ### Step 1: Understanding the Skill with Concrete Examples
Skip this step only when the skill's usage patterns are already clearly understood. It remains valuable even when working with an existing skill.

To create an effective skill, clearly understand concrete examples of how the skill will be used. This understanding can come from either direct user examples or generated examples that are validated with user feedback.

For example, when building an image-editor skill, relevant questions include:

- "What functionality should the image-editor skill support? Editing, rotating, anything else?"
- "Can you give some examples of how this skill would be used?"
- "I can imagine users asking for things like 'Remove the red-eye from this image' or 'Rotate this image'. Are there other ways you imagine this skill being used?"
- "What would a user say that should trigger this skill?"

To avoid overwhelming users, avoid asking too many questions in a single message. Start with the most important questions and follow up as needed for better effectiveness.

Conclude this step when there is a clear sense of the functionality the skill should support.

### ### Step 2: Planning the Reusable Skill Contents
To turn concrete examples into an effective skill, analyze each example by:

1. Considering how to execute on the example from scratch
2. Identifying what scripts, references, and assets would be helpful when executing these workflows repeatedly

Example: When building a `pdf-editor` skill to handle queries like "Help me rotate this PDF," the analysis shows:

1. Rotating a PDF requires re-writing the same code each time
2. A `scripts/rotate_pdf.py` script would be helpful to store in the skill

Example: When designing a `frontend-webapp-builder` skill for queries like "Build me a todo app" or "Build me a dashboard to track my steps," the analysis shows:

1. Writing a frontend webapp requires the same boilerplate HTML/React each time
2. An `assets/hello-world/` template containing the boilerplate HTML/React project files would be helpful to store in the skill

Example: When building a `big-query` skill to handle queries like "How many users have logged in today?" the analysis shows:

1. Querying BigQuery requires re-discovering the table schemas and relationships each time
2. A `references/schema.md` file documenting the table schemas would be helpful to store in the skill

To establish the skill's contents, analyze each concrete example to create a list of the reusable resources to include: scripts, references, and assets.

### ### Step 3: Initializing the Skill
At this point, it is time to actually create the skill.

Skip this step only if the skill being developed already exists. In this case, continue to the next step.

When creating a new skill from scratch, always run the `init_skill.py` script. The script conveniently generates a new template skill directory that automatically includes everything a skill requires, making the skill creation process much more efficient and reliable.

Usage:

```bash
scripts/init_skill.py <skill-name> --path <output-directory> [--resources scripts,references,assets] [--examples]
```

Examples:

```bash
scripts/init_skill.py my-skill --path skills/public
scripts/init_skill.py my-skill --path skills/public --resources scripts,references
scripts/init_skill.py my-skill --path skills/public --resources scripts --examples
```

The script:

- Creates the skill directory at the specified path
- Generates a SKILL.md template with proper frontmatter and TODO placeholders
- Creates `agents/openai.yaml` using agent-generated `display_name`, `short_description`, and `default_prompt` passed via `--interface key=value`
- Optionally creates resource directories based on `--resources`
- Optionally adds example files when `--examples` is set

After initialization, customize the SKILL.md and add resources as needed. If you used `--examples`, replace or delete placeholder files.

Generate `display_name`, `short_description`, and `default_prompt` by reading the skill, then pass them as `--interface key=value` to `init_skill.py` or regenerate with:

```bash
scripts/generate_openai_yaml.py <path/to/skill-folder> --interface key=value
```

Only include other optional interface fields when the user explicitly provides them. For full field descriptions and examples, see references/openai_yaml.md.

### ### Step 4: Edit the Skill
When editing the (newly-generated or existing) skill, remember that the skill is being created for another instance of Codex to use. Include information that would be beneficial and non-obvious to Codex. Consider what procedural knowledge, domain-specific details, or reusable assets would help another Codex instance execute these tasks more effectively.

### #### Start with Reusable Skill Contents
To begin implementation, start with the reusable resources identified above: `scripts/`, `references/`, and `assets/` files. Note that this step may require user input. For example, when implementing a `brand-guidelines` skill, the user may need to provide brand assets or templates to store in `assets/`, or documentation to store in `references/`.

Added scripts must be tested by actually running them to ensure there are no bugs and that the output matches what is expected. If there are many similar scripts, only a representative sample needs to be tested to ensure confidence that they all work while balancing time to completion.

If you used `--examples`, delete any placeholder files that are not needed for the skill. Only create resource directories that are actually required.

### #### Update SKILL.md
**Writing Guidelines:** Always use imperative/infinitive form.

### ##### Frontmatter
Write the YAML frontmatter with `name` and `description`:

- `name`: The skill name
- `description`: This is the primary triggering mechanism for your skill, and helps Codex understand when to use the skill.
  - Include both what the Skill does and specific triggers/contexts for when to use it.
  - Include all "when to use" information here - Not in the body. The body is only loaded after triggering, so "When to Use This Skill" sections in the body are not helpful to Codex.
  - Example description for a `docx` skill: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when Codex needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"

Do not include any other fields in YAML frontmatter.

### ##### Body
Write instructions for using the skill and its bundled resources.

### ### Step 5: Validate the Skill
Once development of the skill is complete, validate the skill folder to catch basic issues early:

```bash
scripts/quick_validate.py <path/to/skill-folder>
```

The validation script checks YAML frontmatter format, required fields, and naming rules. If validation fails, fix the reported issues and run the command again.

### ### Step 6: Iterate
After testing the skill, users may request improvements. Often this happens right after using the skill, with fresh context of how the skill performed.

**Iteration workflow:**

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Implement changes and test again
---
name: skill-installer
description: Install Codex skills into $CODEX_HOME/skills from a curated list or a GitHub repo path. Use when a user asks to list installable skills, install a curated skill, or install a skill from another repo (including private repos).
metadata:
  short-description: Install curated skills from openai/skills or other repos
---

### # Skill Installer
Helps install skills. By default these are from https://github.com/openai/skills/tree/main/skills/.curated, but users can also provide other locations. Experimental skills live in https://github.com/openai/skills/tree/main/skills/.experimental and can be installed the same way.

Use the helper scripts based on the task:
- List skills when the user asks what is available, or if the user uses this skill without specifying what to do. Default listing is `.curated`, but you can pass `--path skills/.experimental` when they ask about experimental skills.
- Install from the curated list when the user provides a skill name.
- Install from another repo when the user provides a GitHub repo/path (including private repos).

Install skills with the helper scripts.

### ## Communication
When listing skills, output approximately as follows, depending on the context of the user's request. If they ask about experimental skills, list from `.experimental` instead of `.curated` and label the source accordingly:
"""
Skills from {repo}:
1. skill-1
2. skill-2 (already installed)
3. ...
Which ones would you like installed?
"""

After installing a skill, tell the user: "Restart Codex to pick up new skills."

### ## Scripts
All of these scripts use network, so when running in the sandbox, request escalation when running them.

- `scripts/list-skills.py` (prints skills list with installed annotations)
- `scripts/list-skills.py --format json`
- Example (experimental list): `scripts/list-skills.py --path skills/.experimental`
- `scripts/install-skill-from-github.py --repo <owner>/<repo> --path <path/to/skill> [<path/to/skill> ...]`
- `scripts/install-skill-from-github.py --url https://github.com/<owner>/<repo>/tree/<ref>/<path>`
- Example (experimental skill): `scripts/install-skill-from-github.py --repo openai/skills --path skills/.experimental/<skill-name>`

### ## Behavior and Options
- Defaults to direct download for public GitHub repos.
- If download fails with auth/permission errors, falls back to git sparse checkout.
- Aborts if the destination skill directory already exists.
- Installs into `$CODEX_HOME/skills/<skill-name>` (defaults to `~/.codex/skills`).
- Multiple `--path` values install multiple skills in one run, each named from the path basename unless `--name` is supplied.
- Options: `--ref <ref>` (default `main`), `--dest <path>`, `--method auto|download|git`.

### ## Notes
- Curated listing is fetched from `https://github.com/openai/skills/tree/main/skills/.curated` via the GitHub API. If it is unavailable, explain the error and exit.
- Private GitHub repos can be accessed via existing git credentials or optional `GITHUB_TOKEN`/`GH_TOKEN` for download.
- Git fallback tries HTTPS first, then SSH.
- The skills at https://github.com/openai/skills/tree/main/skills/.system are preinstalled, so no need to help users install those. If they ask, just explain this. If they insist, you can download and overwrite.
- Installed annotations come from `$CODEX_HOME/skills`.
You are Codex, a coding agent based on GPT-5. You and the user share the same workspace and collaborate to achieve the user's goals.

### ## Finalization rule
Only output the final plan when it is decision complete and leaves no decisions to the implementer.

When you present the official plan, wrap it in a `<proposed_plan>` block so the client can render it specially:

1) The opening tag must be on its own line.
2) Start the plan content on the next line (no text on the same line as the tag).
3) The closing tag must be on its own line.
4) Use Markdown inside the block.
5) Keep the tags exactly as `<proposed_plan>` and `</proposed_plan>` (do not translate or rename them), even if the plan content is in another language.

Example:

<proposed_plan>
plan content
</proposed_plan>

plan content should be human and agent digestible. The final plan must be plan-only and include:

* A clear title
* A brief summary section
* Important changes or additions to public APIs/interfaces/types
* Test cases and scenarios
* Explicit assumptions and defaults chosen where needed

Do not ask "should I proceed?" in the final output. The user can easily switch out of Plan mode and request implementation if you have included a `<proposed_plan>` block in your response. Alternatively, they can decide to stay in Plan mode and continue refining the plan.

Only produce at most one `<proposed_plan>` block per turn, and only when you are presenting a complete spec.

If the user stays in Plan mode and asks for revisions after a prior `<proposed_plan>`, any new `<proposed_plan>` must be a complete replacement.
You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM that will resume the task.

Include:
- Current progress and key decisions made
- Important context, constraints, or user preferences
- What remains to be done (clear next steps)
- Any critical data, examples, or references needed to continue

Be concise, structured, and focused on helping the next LLM seamlessly continue the work.
Another language model started to solve this problem and produced a summary of its thinking process. You also have access to the...
[Truncated]

### ## What's in Memory
This is a compact index to help future agents quickly find details in `MEMORY.md`,
`skills/`, and `rollout_summaries/`.
Organize by topic. Each bullet should include: topic, keywords (used to search over
memory files), and a brief description.
Ordered by utility - which is the most likely to be useful for a future agent.

Recommended format:
- <topic>: <keyword1>, <keyword2>, <keyword3>, ...
  - desc: <brief description>

Notes:
- Do not include large snippets; push details into MEMORY.md and rollout summaries.
- Prefer topics/keywords that help a future agent search MEMORY.md efficiently.

============================================================
3) `skills/` FORMAT (optional)
============================================================

A skill is a reusable "slash-command" package: a directory containing a SKILL.md
entrypoint (YAML frontmatter + instructions), plus optional supporting files.

Where skills live (in this memory folder):
skills/<skill-name>/
  SKILL.md                 # required entrypoint
  scripts/<tool>.*         # optional; executed, not loaded (prefer stdlib-only)
  templates/<tpl>.md       # optional; filled in by the model
  examples/<example>.md    # optional; expected output format / worked example

What to turn into a skill (high priority):
- recurring tool/workflow sequences
- recurring failure shields with a proven fix + verification
- recurring formatting/contracts that must be followed exactly
- recurring "efficient first steps" that reliably reduce search/tool calls
- Create a skill when the procedure repeats (more than once) and clearly saves time or
  reduces errors for future agents.
- It does not need to be broadly general; it just needs to be reusable and valuable.

Skill quality rules (strict):
- Merge duplicates aggressively; prefer improving an existing skill.
- Keep scopes distinct; avoid overlapping "do-everything" skills.
- A skill must be actionable: triggers + inputs + procedure + verification + efficiency plan.
- Do n...
[Truncated]

### ## Memory
You have access to a memory folder with guidance from prior runs. It can save
time and help you stay consistent. Use it whenever it is likely to help.

Decision boundary: should you use memory for a new user query?
- You may skip memory when the new query is trivial (for example,
a one-line change, chit-chat, or simple formatting) or clearly
unrelated to this workspace or the memory summary below.
- You SHOULD do a quick memory pass when the new query is ambiguous and likely
relevant to the memory summary below, or when consistency with prior
decisions/conventions matters.
Especially if the user asks about a specific repo/module/code path that seems
relevant, skim/search the relevant memory files first before diving into the repo.

Memory layout (general -> specific):
- {{ base_path }}/memory_summary.md (already provided below; do NOT open
again)
- {{ base_path }}/MEMORY.md (searchable registry; primary file to query)
- {{ base_path }}/skills/<skill-name>/ (skill folder)
  - SKILL.md (entrypoint instructions)
  - scripts/ (optional helper scripts)
  - examples/ (optional example outputs)
  - templates/ (optional templates)
- {{ base_path }}/rollout_summaries/ (per-rollout recaps + evidence snippets)

Quick memory pass (when applicable):
1) Skim the MEMORY_SUMMARY included below and extract a few task-relevant
keywords (for example repo/module names, error strings, etc.).
2) Search {{ base_path }}/MEMORY.md for those keywords, and for any referenced
rollout summary files and skills.
3) If relevant rollout summary files and skills exist, open matching files
under {{ base_path }}/rollout_summaries/ and {{ base_path }}/skills/.
4) If nothing relevant turns up, proceed normally without memory.

During execution: if you hit repeated errors, confusing behavior, or you suspect
there is relevant prior context, it is worth redoing the quick memory pass.

When to update memory:
- Treat memory as guidance, not truth: if memory conflicts with the current
repo state, tool outputs...
[Truncated]

### ## Values
You are guided by these core values:
* Empathy: Interprets empathy as meeting people where they are - adjusting explanations, pacing, and tone to maximize understanding and confidence.
* Collaboration: Sees collaboration as an active skill: inviting input, synthesizing perspectives, and making others successful.
* Ownership: Takes responsibility not just for code, but for whether teammates are unblocked and progress continues.

### # Apps tool discovery
Searches over apps tool metadata with BM25 and exposes matching tools for the next model call.

MCP tools of the apps ({{app_names}}) are hidden until you search for them with this tool (`search_tool_bm25`).

Follow this workflow:

1. Call `search_tool_bm25` with:
   - `query` (required): focused terms that describe the capability you need.
   - `limit` (optional): maximum number of tools to return (default `8`).
2. Use the returned `tools` list to decide which Apps tools are relevant.
3. Matching tools are added to available `tools` and available for the remainder of the current session/thread.
4. Repeated searches in the same session/thread are additive: new matches are unioned into `tools`.

Notes:
- Core tools remain available without searching.
- If you are unsure, start with `limit` between 5 and 10 to see a broader set of tools.
- `query` is matched against Apps tool metadata fields:
  - `name`
  - `tool_name`
  - `server_name`
  - `title`
  - `description`
  - `connector_name`
  - input schema property keys (`input_keys`)
- If the needed app is already explicit in the prompt (for example `[$app-name](app://{connector_id})`) or already present in the current `tools` list, you can call that tool directly.
- Do not use `search_tool_bm25` for non-apps/local tasks (filesystem, repo search, or shell-only workflows) or anything not related to {{app_names}}.
WARNING: this code is mainly generated by Codex and should not be used in production

### # Codex MCP Server Interface [experimental]
This document describes Codex’s experimental MCP server interface: a JSON‑RPC API that runs over the Model Context Protocol (MCP) transport to control a local Codex engine.

- Status: experimental and subject to change without notice
- Server binary: `codex mcp-server` (or `codex-mcp-server`)
- Transport: standard MCP over stdio (JSON‑RPC 2.0, line‑delimited)

### ## Overview
Codex exposes a small set of MCP‑compatible methods to create and manage conversations, send user input, receive live events, and handle approval prompts. The types are defined in `protocol/src/mcp_protocol.rs` and re‑used by the MCP server implementation in `mcp-server/`.

At a glance:

- Conversations
  - `newConversation` → start a Codex session
  - `sendUserMessage` / `sendUserTurn` → send user input into a conversation
  - `interruptConversation` → stop the current turn
  - `listConversations`, `resumeConversation`, `archiveConversation`
- Configuration and info
  - `getUserSavedConfig`, `setDefaultModel`, `getUserAgent`, `userInfo`
  - `model/list` → enumerate available models and reasoning options
  - `collaborationMode/list` → enumerate collaboration mode presets (experimental)
- Auth
  - `account/read`, `account/login/start`, `account/login/cancel`, `account/logout`, `account/rateLimits/read`
  - notifications: `account/login/completed`, `account/updated`, `account/rateLimits/updated`
- Utilities
  - `gitDiffToRemote`, `execOneOffCommand`
- Approvals (server → client requests)
  - `applyPatchApproval`, `execCommandApproval`
- Notifications (server → client)
  - `loginChatGptComplete`, `authStatusChange`
  - `codex/event` stream with agent events

See code for full type definitions and exact shapes: `protocol/src/mcp_protocol.rs`.

### ## Starting the server
Run Codex as an MCP server and connect an MCP client:

```bash
codex mcp-server | your_mcp_client
```

For a simple inspection UI, you can also try:

```bash
npx @modelcontextprotocol/inspector codex mcp-server
```

Use the separate `codex mcp` subcommand to manage configured MCP server launchers in `config.toml`.

### ## Tool responses
The `codex` and `codex-reply` tools return standard MCP `CallToolResult` payloads. For
compatibility with MCP clients that prefer `structuredContent`, Codex mirrors the
content blocks inside `structuredContent` alongside the `threadId`.

Example:

```json
{
  "content": [{ "type": "text", "text": "Hello from Codex" }],
  "structuredContent": {
    "threadId": "019bbed6-1e9e-7f31-984c-a05b65045719",
    "content": "Hello from Codex"
  }
}
```

### ## Approvals (server → client)
When Codex needs approval to apply changes or run commands, the server issues JSON‑RPC requests to the client:

- `applyPatchApproval { conversationId, callId, fileChanges, reason?, grantRoot? }`
- `execCommandApproval { conversationId, callId, approvalId?, command, cwd, reason? }`

The client must reply with `{ decision: "allow" | "deny" }` for each request.

### ## Compatibility and stability
This interface is experimental. Method names, fields, and event shapes may evolve. For the authoritative schema, consult `protocol/src/mcp_protocol.rs` and the corresponding server wiring in `mcp-server/`.
Overview of Protocol defined in [protocol.rs](../protocol/src/protocol.rs) and [agent.rs](../core/src/agent.rs).

The goal of this document is to define terminology used in the system and explain the expected behavior of the system.

NOTE: The code might not completely match this spec. There are a few minor changes that need to be made after this spec has been reviewed, which will not alter the existing TUI's functionality.

### ## Interface
- `Codex`
  - Communicates with UI via a `SQ` (Submission Queue) and `EQ` (Event Queue).
- `Submission`
  - These are messages sent on the `SQ` (UI -> `Codex`)
  - Has an string ID provided by the UI, referred to as `sub_id`
  - `Op` refers to the enum of all possible `Submission` payloads
    - This enum is `non_exhaustive`; variants can be added at future dates
- `Event`
  - These are messages sent on the `EQ` (`Codex` -> UI)
  - Each `Event` has a non-unique ID, matching the `sub_id` from the user-turn op that started the current task.
  - `EventMsg` refers to the enum of all possible `Event` payloads
    - This enum is `non_exhaustive`; variants can be added at future dates
    - It should be expected that new `EventMsg` variants will be added over time to expose more detailed information about the model's actions.

For complete documentation of the `Op` and `EventMsg` variants, refer to [protocol.rs](../protocol/src/protocol.rs). Some example payload types:

- `Op`
  - `Op::UserTurn` – Any input from the user to kick off a `Turn`
  - `Op::UserInput` – Legacy form of user input
  - `Op::Interrupt` – Interrupts a running turn
  - `Op::ExecApproval` – Approve or deny code execution
  - `Op::UserInputAnswer` – Provide answers for a `request_user_input` tool call
  - `Op::ListSkills` – Request skills for one or more cwd values (optionally `force_reload`)
  - `Op::UserTurn` and `Op::OverrideTurnContext` accept an optional `personality` override that updates the model’s communication style

Valid `personality` values are `friendly`, `pragmatic`, and `none`. When `none` is selected, the personality placeholder is replaced with an empty string.

- `EventMsg`
  - `EventMsg::AgentMessage` – Messages from the `Model`
  - `EventMsg::AgentMessageContentDelta` – Streaming assistant text
  - `EventMsg::PlanDelta` – Streaming proposed plan text when the model emits a `<proposed_plan>` block in plan mode
  - `EventMsg::ExecApprovalRequest` – Request approval from user to execute...
[Truncated]

### ### UserInput items
`Op::UserTurn` content items can include:

- `text` – Plain text plus optional UI text elements.
- `image` / `local_image` – Image inputs.
- `skill` – Explicit skill selection (`name`, `path` to `SKILL.md`).
- `mention` – Explicit app/connector selection (`name`, `path` in `app://{connector_id}` form).

Note: For v1 wire compatibility, `EventMsg::TurnStarted` and `EventMsg::TurnComplete` serialize as `task_started` / `task_complete`. The deserializer accepts both `task_*` and `turn_*` tags.

The `response_id` returned from each turn matches the OpenAI `response_id` stored in the API's `/responses` endpoint. It can be stored and used in future `Sessions` to resume threads of work.

### # codex-exec-server
This crate contains the code for two executables:

- `codex-exec-mcp-server` is an MCP server that provides a tool named `shell` that runs a shell command inside a sandboxed shell process. Every resulting `execve(2)` call made within that shell is intercepted and run via the executable defined by the `EXEC_WRAPPER` environment variable within the shell process. In practice, `EXEC_WRAPPER` is set to `codex-execve-wrapper`.
- `codex-execve-wrapper` is the executable that takes the arguments to the `execve(2)` call and "escalates" it to the MCP server via a shared file descriptor (specified by the `CODEX_ESCALATE_SOCKET` environment variable) for consideration. Based on the [Codex `.rules`](https://developers.openai.com/codex/local-config#rules-preview), the MCP server replies with one of:
  - `Run`: `codex-execve-wrapper` should invoke `execve(2)` on itself to run the original command within Bash
  - `Escalate`: forward the file descriptors of the current process to the MCP server so the command can be run faithfully outside the sandbox. Because the MCP server will have the original FDs for `stdout` and `stderr`, it can write those directly. When the process completes, the MCP server forwards the exit code to `codex-execve-wrapper` so that it exits in a consistent manner.
  - `Deny`: the MCP server has declared the proposed command to be "forbidden," so `codex-execve-wrapper` will print an error to `stderr` and exit with `1`.

### ## Release workflow
`.github/workflows/shell-tool-mcp.yml` builds the Rust binaries, compiles the patched Bash variants, assembles the `vendor/` tree, and creates `codex-shell-tool-mcp-npm-<version>.tgz` for inclusion in the Rust GitHub Release. When the version is a stable or alpha tag, the workflow also publishes the tarball to npm using OIDC. The workflow is invoked from `rust-release.yml` so the package ships alongside other Codex artifacts.

### # including CONNECT tunnels in full mode.
allow_upstream_proxy = true

### #### MCP client
Codex CLI functions as an MCP client that allows the Codex CLI and IDE extension to connect to MCP servers on startup. See the [`configuration documentation`](../docs/config.md#connecting-to-mcp-servers) for details.

### #### MCP server (experimental)
Codex can be launched as an MCP _server_ by running `codex mcp-server`. This allows _other_ MCP clients to use Codex as a tool for another agent.

Use the [`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector) to try it out:

```shell
npx @modelcontextprotocol/inspector codex mcp-server
```

Use `codex mcp` to add/list/get/remove MCP server launchers defined in `config.toml`, and `codex mcp-server` to run the MCP server directly.

### # codex-stdio-to-uds
Traditionally, there are two transport mechanisms for an MCP server: stdio and HTTP.

This crate helps enable a third, which is UNIX domain socket, because it has the advantages that:

- The UDS can be attached to long-running process, like an HTTP server.
- The UDS can leverage UNIX file permissions to restrict access.

To that end, this crate provides an adapter between a UDS and stdio. The idea is that someone could start an MCP server that communicates over `/tmp/mcp.sock`. Then the user could specify this on the fly like so:

```
codex --config mcp_servers.example={command="codex-stdio-to-uds",args=["/tmp/mcp.sock"]}
```

Unfortunately, the Rust standard library does not provide support for UNIX domain sockets on Windows today even though support was added in October 2018 in Windows 10:

https://github.com/rust-lang/rust/issues/56533

As a workaround, this crate leverages https://crates.io/crates/uds_windows as a dependency on Windows.
Generate a file named AGENTS.md that serves as a contributor guide for this repository.
Your goal is to produce a clear, concise, and well-structured document with descriptive headings and actionable explanations for each section.
Follow the outline below, but adapt as needed — add sections if relevant, and omit those that do not apply to this project.

Document Requirements

- Title the document "Repository Guidelines".
- Use Markdown headings (#, ##, etc.) for structure.
- Keep the document concise. 200-400 words is optimal.
- Keep explanations short, direct, and specific to this repository.
- Provide examples where helpful (commands, directory paths, naming patterns).
- Maintain a professional, instructional tone.

Recommended Sections

Project Structure & Module Organization

- Outline the project structure, including where the source code, tests, and assets are located.

Build, Test, and Development Commands

- List key commands for building, testing, and running locally (e.g., npm test, make build).
- Briefly explain what e...
[Truncated]

### ## Connecting to MCP servers
Codex can connect to MCP servers configured in `~/.codex/config.toml`. See the configuration reference for the latest MCP server options:

- https://developers.openai.com/codex/config-reference

### ## Apps (Connectors)
Use `$` in the composer to insert a ChatGPT connector; the popover lists accessible
apps. The `/apps` command lists available and installed apps. Connected apps appear first
and are labeled as connected; others are marked as can be installed.

### ## Tracing / verbose logging
Codex is written in Rust, so it honors the `RUST_LOG` environment variable to configure its logging behavior.

The TUI defaults to `RUST_LOG=codex_core=info,codex_tui=info,codex_rmcp_client=info` and log messages are written to `~/.codex/log/codex-tui.log` by default. For a single run, you can override the log directory with `-c log_dir=...` (for example, `-c log_dir=./.codex-log`).

```bash
tail -F ~/.codex/log/codex-tui.log
```

By comparison, the non-interactive mode (`codex exec`) defaults to `RUST_LOG=error`, but messages are printed inline, so there is no need to monitor a separate file.

See the Rust documentation on [`RUST_LOG`](https://docs.rs/env_logger/latest/env_logger/#enabling-logging) for more information on the configuration options.

### # Skills
For information about skills, refer to [this documentation](https://developers.openai.com/codex/skills).

### ## High-level state machines
`ChatComposer` effectively combines two small state machines:

1. **UI mode**: which popup (if any) is active.
   - `ActivePopup::None | Command | File | Skill`
2. **Paste burst**: transient detection state for non-bracketed paste.
   - implemented by `PasteBurst`

### ## Runtime command
Run Codex with chunking traces enabled:

```bash
RUST_LOG='codex_tui::streaming::commit_tick=trace,codex_tui=info,codex_core=info,codex_rmcp_client=info' \
  just codex --enable=responses_websockets
```

### # @openai/codex-shell-tool-mcp
**Note: This MCP server is still experimental. When using it with Codex CLI, ensure the CLI version matches the MCP server version.**

`@openai/codex-shell-tool-mcp` is an MCP server that provides a tool named `shell` that runs a shell command inside a sandboxed instance of Bash. This special instance of Bash intercepts requests to spawn new processes (specifically, [`execve(2)`](https://man7.org/linux/man-pages/man2/execve.2.html) calls). For each call, it makes a request back to the MCP server to determine whether to allow the proposed command to execute. It also has the option of _escalating_ the command to run unprivileged outside of the sandbox governing the Bash process.

The user can use [Codex `.rules`](https://developers.openai.com/codex/local-config#rules-preview) files to define how a command should be handled. The action to take is determined by the `decision` parameter of a matching rule as follows:

- `allow`: the command will be _escalated_ and run outside the sandbox
- `prompt`: the command will be subject to human approval via an [MCP elicitation](https://modelcontextprotocol.io/specification/draft/client/elicitation) (it will run _escalated_ if approved)
- `forbidden`: the command will fail with exit code `1` and an error message will be written to `stderr`

Commands that do not match an explicit rule in `.rules` will be allowed to run as-is, though they will still be subject to the sandbox applied to the parent Bash process.

### ## Motivation
When a software agent asks if it is safe to run a command like `ls`, without more context, it is unclear whether it will result in executing `/bin/ls`. Consider:

- There could be another executable named `ls` that appears before `/bin/ls` on the `$PATH`.
- `ls` could be mapped to a shell alias or function.

Because `@openai/codex-shell-tool-mcp` intercepts `execve(2)` calls directly, it _always_ knows the full path to the program being executed. In turn, this makes it possible to provide stronger guarantees on how [Codex `.rules`](https://developers.openai.com/codex/local-config#rules-preview) are enforced.

### ## Usage
First, verify that you can download and run the MCP executable:

```bash
npx -y @openai/codex-shell-tool-mcp --version
```

To test out the MCP with a one-off invocation of Codex CLI, it is important to _disable_ the default shell tool in addition to enabling the MCP so Codex has exactly one shell-like tool available to it:

```bash
codex --disable shell_tool \
  --config 'mcp_servers.bash={command = "npx", args = ["-y", "@openai/codex-shell-tool-mcp"]}'
```

To configure this permanently so you can use the MCP while running `codex` without additional command-line flags, add the following to your `~/.codex/config.toml`:

```toml
[features]
shell_tool = false

[mcp_servers.shell-tool]
command = "npx"
args = ["-y", "@openai/codex-shell-tool-mcp"]
```

Note when the `@openai/codex-shell-tool-mcp` launcher runs, it selects the appropriate native binary to run based on the host OS/architecture. For the Bash wrapper, it inspects `/etc/os-release` on Linux or the Darwin major version on macOS to try to find the best match it has available. See [`bashSelection.ts`](https://github.com/openai/codex/blob/main/shell-tool-mcp/src/bashSelection.ts) for details.

### ## MCP Client Requirements
This MCP server is designed to be used with [Codex](https://developers.openai.com/codex/cli), as it declares the following `capability` that Codex supports when acting as an MCP client:

```json
{
  "capabilities": {
    "experimental": {
      "codex/sandbox-state": {
        "version": "1.0.0"
      }
    }
  }
}
```

This capability means the MCP server honors requests like the following to update the sandbox policy the MCP server uses when spawning Bash:

```json
{
  "id": "req-42",
  "method": "codex/sandbox-state/update",
  "params": {
    "sandboxPolicy": {
      "type": "workspace-write",
      "writable_roots": ["/home/user/code/codex"],
      "network_access": false,
      "exclude_tmpdir_env_var": false,
      "exclude_slash_tmp": false
    }
  }
}
```

Once the server has processed the update, it sends an empty response to acknowledge the request:

```json
{
  "id": "req-42",
  "result": {}
}
```

The Codex harness (used by the CLI and the VS Code extension) sends such requests to MCP servers that declare the `codex/sandbox-state` capability.

### ## Package Contents
This package wraps the `codex-exec-mcp-server` binary and its helpers so that the shell MCP can be invoked via `npx -y @openai/codex-shell-tool-mcp`. It bundles:

- `codex-exec-mcp-server` and `codex-execve-wrapper` built for macOS (arm64, x64) and Linux (musl arm64, musl x64).
- A patched Bash that honors `EXEC_WRAPPER`, built for multiple glibc baselines (Ubuntu 24.04/22.04/20.04, Debian 12/11, CentOS-like 9) and macOS (15/14/13).
- A launcher (`bin/mcp-server.js`) that picks the correct binaries for the current `process.platform` / `process.arch`, specifying `--execve` and `--bash` for the MCP, as appropriate.

See [the README in the Codex repo](https://github.com/openai/codex/blob/main/codex-rs/exec-server/README.md) for details.

## claude_cli
### ## Source: /docs/en/overview
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Getting started

Claude Code overview

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Getting started

Overview

Quickstart

Changelog

Core concepts

How Claude Code works

Extend Claude Code

Common workflows

Best practices

Platforms and integrations

Claude Code on the web

Claude Code on desktop

Chrome extension (beta)

Visual Studio Code

JetBrains IDEs

GitHub Actions

GitLab CI/CD

Claude Code in Slack

On this page

Get started

What you can do

Use Claude Code everywhere

Next steps

Getting started

Claude Code overview

Copy page

Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools. Available in your terminal, IDE, desktop app, and browser.

Copy page

Claude Code is an AI-powered coding assistant that helps you build features, fix bugs, and automate development tasks. It understands your entire codebase and can work across multiple files and tools to get things done.

​

Get started

Choose your environment to get started. Most surfaces require a

Claude subscription

or

Anthropic Console

account. The Terminal CLI and VS Code also support

third-party providers

.

Terminal

VS Code

Desktop app

Web

JetBrains

The full-featured CLI for working with Claude Code directly in your terminal. Edit files, run commands, and manage your entire project from the command line.

To install Claude Code, use one of the following methods:

Native Install (Recommended)

Homebrew

WinGet

macOS, Linux, WSL:

Report incorrect code

Copy

Ask AI

curl

-fsSL

https://claude.ai/install.sh

|

bash

Windows PowerShell:

Report incorrect code

Copy

Ask AI

irm https:

//

claude.ai

/

install.ps1

|

iex

Windows CMD:

Report incorrect code

Copy

A...
[Truncated]

### # Bulk operations across files
git

diff

main

--name-only

|

claude

-p

"review these changed files for security issues"

See the

CLI reference

for the full set of commands and flags.

Work from anywhere

Sessions aren’t tied to a single surface. Move work between environments as your context changes:

Kick off a long-running task on the

web

or

iOS app

, then pull it into your terminal with

/teleport

Hand off a terminal session to the

Desktop app

with

/desktop

for visual diff review

Route tasks from team chat: mention

@Claude

in

Slack

with a bug report and get a pull request back

​

Use Claude Code everywhere

Each surface connects to the same underlying Claude Code engine, so your CLAUDE.md files, settings, and MCP servers work across all of them.

Beyond the

Terminal

,

VS Code

,

JetBrains

,

Desktop

, and

Web

environments above, Claude Code integrates with CI/CD, chat, and browser workflows:

I want to…

Best option

Start a task locally, continue on mobile

Web

or

Claude iOS app

Automate PR reviews and issue triage

GitHub Actions

or

GitLab CI/CD

Route bug reports from Slack to pull requests

Slack

Debug live web applications

Chrome

Build custom agents for your own workflows

Agent SDK

​

Next steps

Once you’ve installed Claude Code, these guides help you go deeper.

Quickstart

: walk through your first real task, from exploring a codebase to committing a fix

Level up with

best practices

and

common workflows

Settings

: customize Claude Code for your workflow

Troubleshooting

: solutions for common issues

code.claude.com

: demos, pricing, and product details

Was this page helpful?

Yes

No

Quickstart

Claude Code Docs

home page

x

linkedin

Company

Anthropic

Careers

Economic Futures

Research

News

Trust center

Transparency

Help and security

Availability

Status

Support center

Learn

Courses

MCP connectors

Customer stories

Engineering blog

Events

Powered by Claude

Service partners

Startups program

Terms and policies

Priva...
[Truncated]

### ## Source: /docs/en/setup
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Administration

Set up Claude Code

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Administration

Advanced installation

Authentication

Security

Server-managed settings (beta)

Data usage

Monitoring

Costs

Track team usage with analytics

Create and distribute a plugin marketplace

On this page

System requirements

Additional dependencies

Installation

Platform-specific setup

Authentication

For individuals

For teams and organizations

Install a specific version

Binary integrity and code signing

NPM installation (deprecated)

Windows setup

Update Claude Code

Auto updates

Configure release channel

Disable auto-updates

Update manually

Uninstall Claude Code

Native installation

Homebrew installation

WinGet installation

NPM installation

Clean up configuration files (optional)

Administration

Set up Claude Code

Copy page

Install, authenticate, and start using Claude Code on your development machine.

Copy page

​

System requirements

Operating System

:

macOS 13.0+

Windows 10 1809+ or Windows Server 2019+ (

see setup notes

)

Ubuntu 20.04+

Debian 10+

Alpine Linux 3.19+ (

additional dependencies required

)

Hardware

: 4 GB+ RAM

Network

: Internet connection required (see

network configuration

)

Shell

: Works best in Bash or Zsh

Location

:

Anthropic supported countries

​

Additional dependencies

ripgrep

: Usually included with Claude Code. If search fails, see

search troubleshooting

.

Node.js 18+

: Only required for

deprecated npm installation

​

Installation

To install Claude Code, use one of the following methods:

Native Install (Recommended)

Homebrew

WinGet

macOS, Linux, WSL:

Report incorrect code

Copy

Ask AI

curl

-fsSL

https://claude.ai/install.sh

|

bash

Windows Powe...
[Truncated]

### # Remove project-specific settings (run from your project directory)
rm

-rf

.claude

rm

-f

.mcp.json

Windows PowerShell:

Report incorrect code

Copy

Ask AI

### # Remove project-specific settings (run from your project directory)
Remove-Item

-

Path

".claude"

-

Recurse

-

Force

Remove-Item

-

Path

".mcp.json"

-

Force

Windows CMD:

Report incorrect code

Copy

Ask AI

REM

Remove user settings and state

rmdir

/s /q

"

%USERPROFILE%

\.claude"

del

"

%USERPROFILE%

\.claude.json"

REM

Remove project-specific settings (run from your project directory)

rmdir

/s /q

".claude"

del

".mcp.json"

Was this page helpful?

Yes

No

Authentication

Claude Code Docs

home page

x

linkedin

Company

Anthropic

Careers

Economic Futures

Research

News

Trust center

Transparency

Help and security

Availability

Status

Support center

Learn

Courses

MCP connectors

Customer stories

Engineering blog

Events

Powered by Claude

Service partners

Startups program

Terms and policies

Privacy policy

Disclosure policy

Usage policy

Commercial terms

Consumer terms

Assistant

Responses are generated using AI and may contain mistakes.

---

### # Follow the prompts to log in with your account
You can log in using any of these account types:

Claude Pro, Max, Teams, or Enterprise

(recommended)

Claude Console

(API access with pre-paid credits). On first login, a “Claude Code” workspace is automatically created in the Console for centralized cost tracking.

Amazon Bedrock, Google Vertex AI, or Microsoft Foundry

(enterprise cloud providers)

Once logged in, your credentials are stored and you won’t need to log in again. To switch accounts later, use the

/login

command.

​

Step 3: Start your first session

Open your terminal in any project directory and start Claude Code:

Report incorrect code

Copy

Ask AI

cd

/path/to/your/project

claude

You’ll see the Claude Code welcome screen with your session information, recent conversations, and latest updates. Type

/help

for available commands or

/resume

to continue a previous conversation.

After logging in (Step 2), your credentials are stored on your system. Learn more in

Credential Management

.

​

Step 4: Ask your first question

Let’s start with understanding your codebase. Try one of these commands:

Report incorrect code

Copy

Ask AI

what does this project do?

Claude will analyze your files and provide a summary. You can also ask more specific questions:

Report incorrect code

Copy

Ask AI

what technologies does this project use?

Report incorrect code

Copy

Ask AI

where is the main entry point?

Report incorrect code

Copy

Ask AI

explain the folder structure

You can also ask Claude about its own capabilities:

Report incorrect code

Copy

Ask AI

what can Claude Code do?

Report incorrect code

Copy

Ask AI

how do I create custom skills in Claude Code?

Report incorrect code

Copy

Ask AI

can Claude Code work with Docker?

Claude Code reads your files as needed - you don’t have to manually add context. Claude also has access to its own documentation and can answer questions about its features and capabilities.

​

Step 5: Make your first code change

Now let’s make Claude Code do...
[Truncated]

### ## Source: /docs/en/features-overview
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Core concepts

Extend Claude Code

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Getting started

Overview

Quickstart

Changelog

Core concepts

How Claude Code works

Extend Claude Code

Common workflows

Best practices

Platforms and integrations

Claude Code on the web

Claude Code on desktop

Chrome extension (beta)

Visual Studio Code

JetBrains IDEs

GitHub Actions

GitLab CI/CD

Claude Code in Slack

On this page

Overview

Match features to your goal

Compare similar features

Understand how features layer

Combine features

Understand context costs

Context cost by feature

Understand how features load

Learn more

Core concepts

Extend Claude Code

Copy page

Understand when to use CLAUDE.md, Skills, subagents, hooks, MCP, and plugins.

Copy page

Claude Code combines a model that reasons about your code with

built-in tools

for file operations, search, execution, and web access. The built-in tools cover most coding tasks. This guide covers the extension layer: features you add to customize what Claude knows, connect it to external services, and automate workflows.

For how the core agentic loop works, see

How Claude Code works

.

New to Claude Code?

Start with

CLAUDE.md

for project conventions. Add other extensions as you need them.

​

Overview

Extensions plug into different parts of the agentic loop:

CLAUDE.md

adds persistent context Claude sees every session

Skills

add reusable knowledge and invocable workflows

MCP

connects Claude to external services and tools

Subagents

run their own loops in isolated context, returning summaries

Agent teams

coordinate multiple independent sessions with shared tasks and peer-to-peer messaging

Hooks

run outside the loop entirely as deterministic scripts

Plugin...
[Truncated]

### ## Source: /docs/en/cli-reference
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Reference

CLI reference

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Reference

CLI reference

Interactive mode

Checkpointing

Hooks reference

Plugins reference

On this page

CLI commands

CLI flags

Agents flag format

System prompt flags

See also

Reference

CLI reference

Copy page

Complete reference for Claude Code command-line interface, including commands and flags.

Copy page

​

CLI commands

Command

Description

Example

claude

Start interactive REPL

claude

claude "query"

Start REPL with initial prompt

claude "explain this project"

claude -p "query"

Query via SDK, then exit

claude -p "explain this function"

cat file | claude -p "query"

Process piped content

cat logs.txt | claude -p "explain"

claude -c

Continue most recent conversation in current directory

claude -c

claude -c -p "query"

Continue via SDK

claude -c -p "Check for type errors"

claude -r "<session>" "query"

Resume session by ID or name

claude -r "auth-refactor" "Finish this PR"

claude update

Update to latest version

claude update

claude mcp

Configure Model Context Protocol (MCP) servers

See the

Claude Code MCP documentation

.

​

CLI flags

Customize Claude Code’s behavior with these command-line flags:

Flag

Description

Example

--add-dir

Add additional working directories for Claude to access (validates each path exists as a directory)

claude --add-dir ../apps ../lib

--agent

Specify an agent for the current session (overrides the

agent

setting)

claude --agent my-custom-agent

--agents

Define custom

subagents

dynamically via JSON (see below for format)

claude --agents '{"reviewer":{"description":"Reviews code","prompt":"You are a code reviewer"}}'

--allow-dangerously-skip-permissions

Enable permission bypa...
[Truncated]

### ## Source: /docs/en/how-claude-code-works
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Core concepts

How Claude Code works

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Getting started

Overview

Quickstart

Changelog

Core concepts

How Claude Code works

Extend Claude Code

Common workflows

Best practices

Platforms and integrations

Claude Code on the web

Claude Code on desktop

Chrome extension (beta)

Visual Studio Code

JetBrains IDEs

GitHub Actions

GitLab CI/CD

Claude Code in Slack

On this page

The agentic loop

Models

Tools

What Claude can access

Work with sessions

Work across branches

Resume or fork sessions

The context window

When context fills up

Manage context with skills and subagents

Stay safe with checkpoints and permissions

Undo changes with checkpoints

Control what Claude can do

Work effectively with Claude Code

Ask Claude Code for help

It’s a conversation

Interrupt and steer

Be specific upfront

Give Claude something to verify against

Explore before implementing

Delegate, don’t dictate

What’s next

Core concepts

How Claude Code works

Copy page

Understand the agentic loop, built-in tools, and how Claude Code interacts with your project.

Copy page

Claude Code is an agentic assistant that runs in your terminal. While it excels at coding, it can help with anything you can do from the command line: writing docs, running builds, searching files, researching topics, and more.

This guide covers the core architecture, built-in capabilities, and

tips for working effectively

. For step-by-step walkthroughs, see

Common workflows

. For extensibility features like skills, MCP, and hooks, see

Extend Claude Code

.

​

The agentic loop

When you give Claude a task, it works through three phases:

gather context

,

take action

, and

verify results

. These phases blend t...
[Truncated]

### ## Source: /docs/en/common-workflows
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Core concepts

Common workflows

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Getting started

Overview

Quickstart

Changelog

Core concepts

How Claude Code works

Extend Claude Code

Common workflows

Best practices

Platforms and integrations

Claude Code on the web

Claude Code on desktop

Chrome extension (beta)

Visual Studio Code

JetBrains IDEs

GitHub Actions

GitLab CI/CD

Claude Code in Slack

On this page

Understand new codebases

Get a quick codebase overview

Find relevant code

Fix bugs efficiently

Refactor code

Use specialized subagents

Use Plan Mode for safe code analysis

When to use Plan Mode

How to use Plan Mode

Example: Planning a complex refactor

Configure Plan Mode as default

Work with tests

Create pull requests

Handle documentation

Work with images

Reference files and directories

Use extended thinking (thinking mode)

Configure thinking mode

How extended thinking works

Resume previous conversations

Name your sessions

Use the session picker

Run parallel Claude Code sessions with Git worktrees

Worktree cleanup

Manage worktrees manually

Get notified when Claude needs your attention

Use Claude as a unix-style utility

Add Claude to your verification process

Pipe in, pipe out

Control output format

Ask Claude about its capabilities

Example questions

Next steps

Core concepts

Common workflows

Copy page

Step-by-step guides for exploring codebases, fixing bugs, refactoring, testing, and other everyday tasks with Claude Code.

Copy page

This page covers practical workflows for everyday development: exploring unfamiliar code, debugging, refactoring, writing tests, creating PRs, and managing sessions. Each section includes example prompts you can adapt to your own projects. For highe...
[Truncated]

### # Clean up when done
git

worktree

list

git

worktree

remove

../project-feature-a

Learn more in the

official Git worktree documentation

.

Remember to initialize your development environment in each new worktree according to your project’s setup. Depending on your stack, this might include running dependency installation (

npm install

,

yarn

), setting up virtual environments, or following your project’s standard setup process.

For automated coordination of parallel sessions with shared tasks and messaging, see

agent teams

.

​

Get notified when Claude needs your attention

When you kick off a long-running task and switch to another window, you can set up desktop notifications so you know when Claude finishes or needs your input. This uses the

Notification

hook event

, which fires whenever Claude is waiting for permission, idle and ready for a new prompt, or completing authentication.

1

Open the hooks menu

Type

/hooks

and select

Notification

from the list of events.

2

Configure the matcher

Select

+ Match all (no filter)

to fire on all notification types. To notify only for specific events, select

+ Add new matcher…

and enter one of these values:

Matcher

Fires when

permission_prompt

Claude needs you to approve a tool use

idle_prompt

Claude is done and waiting for your next prompt

auth_success

Authentication completes

elicitation_dialog

Claude is asking you a question

3

Add your notification command

Select

+ Add new hook…

and enter the command for your OS:

macOS

Linux

Windows (PowerShell)

Uses

osascript

to trigger a native macOS notification through AppleScript:

Report incorrect code

Copy

Ask AI

osascript -e 'display notification "Claude Code needs your attention" with title "Claude Code"'

Uses

notify-send

, which is pre-installed on most Linux desktops with a notification daemon:

Report incorrect code

Copy

Ask AI

notify-send 'Claude Code' 'Claude Code needs your attention'

Uses PowerShell to show a native message box throug...
[Truncated]

### ## Source: /docs/en/best-practices
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Core concepts

Best Practices for Claude Code

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Getting started

Overview

Quickstart

Changelog

Core concepts

How Claude Code works

Extend Claude Code

Common workflows

Best practices

Platforms and integrations

Claude Code on the web

Claude Code on desktop

Chrome extension (beta)

Visual Studio Code

JetBrains IDEs

GitHub Actions

GitLab CI/CD

Claude Code in Slack

On this page

Give Claude a way to verify its work

Explore first, then plan, then code

Provide specific context in your prompts

Provide rich content

Configure your environment

Write an effective CLAUDE.md

Configure permissions

Use CLI tools

Connect MCP servers

Set up hooks

Create skills

Create custom subagents

Install plugins

Communicate effectively

Ask codebase questions

Let Claude interview you

Manage your session

Course-correct early and often

Manage context aggressively

Use subagents for investigation

Rewind with checkpoints

Resume conversations

Automate and scale

Run headless mode

Run multiple Claude sessions

Fan out across files

Safe Autonomous Mode

Avoid common failure patterns

Develop your intuition

Related resources

Core concepts

Best Practices for Claude Code

Copy page

Tips and patterns for getting the most out of Claude Code, from configuring your environment to scaling across parallel sessions.

Copy page

Claude Code is an agentic coding environment. Unlike a chatbot that answers questions and waits, Claude Code can read your files, run commands, make changes, and autonomously work through problems while you watch, redirect, or step away entirely.

This changes how you work. Instead of writing code yourself and asking Claude to review it, you describe what you want a...
[Truncated]

### # Workflow
-

Be sure to typecheck when you're done making a series of code changes

-

Prefer running single tests, and not the whole test suite, for performance

CLAUDE.md is loaded every session, so only include things that apply broadly. For domain knowledge or workflows that are only relevant sometimes, use

skills

instead. Claude loads them on demand without bloating every conversation.

Keep it concise. For each line, ask:

“Would removing this cause Claude to make mistakes?”

If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!

✅ Include

❌ Exclude

Bash commands Claude can’t guess

Anything Claude can figure out by reading code

Code style rules that differ from defaults

Standard language conventions Claude already knows

Testing instructions and preferred test runners

Detailed API documentation (link to docs instead)

Repository etiquette (branch naming, PR conventions)

Information that changes frequently

Architectural decisions specific to your project

Long explanations or tutorials

Developer environment quirks (required env vars)

File-by-file descriptions of the codebase

Common gotchas or non-obvious behaviors

Self-evident practices like “write clean code”

If Claude keeps doing something you don’t want despite having a rule against it, the file is probably too long and the rule is getting lost. If Claude asks you questions that are answered in CLAUDE.md, the phrasing might be ambiguous. Treat CLAUDE.md like code: review it when things go wrong, prune it regularly, and test changes by observing whether Claude’s behavior actually shifts.

You can tune instructions by adding emphasis (e.g., “IMPORTANT” or “YOU MUST”) to improve adherence. Check CLAUDE.md into git so your team can contribute. The file compounds in value over time.

CLAUDE.md files can import additional files using

@path/to/import

syntax:

CLAUDE.md

Report incorrect code

Copy

Ask AI

See @README.md for project overview and @package.json for available ...
[Truncated]

### # Additional Instructions
-

Git workflow: @docs/git-instructions.md

-

Personal overrides: @~/.claude/my-project-instructions.md

You can place CLAUDE.md files in several locations:

Home folder (

~/.claude/CLAUDE.md

)

: Applies to all Claude sessions

Project root (

./CLAUDE.md

)

: Check into git to share with your team, or name it

CLAUDE.local.md

and

.gitignore

it

Parent directories

: Useful for monorepos where both

root/CLAUDE.md

and

root/foo/CLAUDE.md

are pulled in automatically

Child directories

: Claude pulls in child CLAUDE.md files on demand when working with files in those directories

​

Configure permissions

Use

/permissions

to allowlist safe commands or

/sandbox

for OS-level isolation. This reduces interruptions while keeping you in control.

By default, Claude Code requests permission for actions that might modify your system: file writes, Bash commands, MCP tools, etc. This is safe but tedious. After the tenth approval you’re not really reviewing anymore, you’re just clicking through. There are two ways to reduce these interruptions:

Permission allowlists

: Permit specific tools you know are safe (like

npm run lint

or

git commit

)

Sandboxing

: Enable OS-level isolation that restricts filesystem and network access, allowing Claude to work more freely within defined boundaries

Alternatively, use

--dangerously-skip-permissions

to bypass all permission checks for contained workflows like fixing lint errors or generating boilerplate.

Letting Claude run arbitrary commands can result in data loss, system corruption, or data exfiltration via prompt injection. Only use

--dangerously-skip-permissions

in a sandbox without internet access.

Read more about

configuring permissions

and

enabling sandboxing

.

​

Use CLI tools

Tell Claude Code to use CLI tools like

gh

,

aws

,

gcloud

, and

sentry-cli

when interacting with external services.

CLI tools are the most context-efficient way to interact with external services. If you use GitHub, ins...
[Truncated]

### # API Conventions
-

Use kebab-case for URL paths

-

Use camelCase for JSON properties

-

Always include pagination for list endpoints

-

Version APIs in the URL path (/v1/, /v2/)

Skills can also define repeatable workflows you invoke directly:

.claude/skills/fix-issue/SKILL.md

Report incorrect code

Copy

Ask AI

---

name

:

fix-issue

description

:

Fix a GitHub issue

disable-model-invocation

:

true

---

Analyze and fix the GitHub issue: $ARGUMENTS.

1.

Use

`gh issue view`

to get the issue details

2.

Understand the problem described in the issue

3.

Search the codebase for relevant files

4.

Implement the necessary changes to fix the issue

5.

Write and run tests to verify the fix

6.

Ensure code passes linting and type checking

7.

Create a descriptive commit message

8.

Push and create a PR

Run

/fix-issue 1234

to invoke it. Use

disable-model-invocation: true

for workflows with side effects that you want to trigger manually.

​

Create custom subagents

Define specialized assistants in

.claude/agents/

that Claude can delegate to for isolated tasks.

Subagents

run in their own context with their own set of allowed tools. They’re useful for tasks that read many files or need specialized focus without cluttering your main conversation.

.claude/agents/security-reviewer.md

Report incorrect code

Copy

Ask AI

---

name

:

security-reviewer

description

:

Reviews code for security vulnerabilities

tools

:

Read, Grep, Glob, Bash

model

:

opus

---

You are a senior security engineer. Review code for:

-

Injection vulnerabilities (SQL, XSS, command injection)

-

Authentication and authorization flaws

-

Secrets or credentials in code

-

Insecure data handling

Provide specific line references and suggested fixes.

Tell Claude to use subagents explicitly:

“Use a subagent to review this code for security issues.”

​

Install plugins

Run

/plugin

to browse the marketplace. Plugins add skills, tools, and integrations without configuration.

Plug...
[Truncated]

### # Streaming for real-time processing
claude

-p

"Analyze this log file"

--output-format

stream-json

​

Run multiple Claude sessions

Run multiple Claude sessions in parallel to speed up development, run isolated experiments, or start complex workflows.

There are three main ways to run parallel sessions:

Claude Code desktop app

: Manage multiple local sessions visually. Each session gets its own isolated worktree.

Claude Code on the web

: Run on Anthropic’s secure cloud infrastructure in isolated VMs.

Agent teams

: Automated coordination of multiple sessions with shared tasks, messaging, and a team lead.

Beyond parallelizing work, multiple sessions enable quality-focused workflows. A fresh context improves code review since Claude won’t be biased toward code it just wrote.

For example, use a Writer/Reviewer pattern:

Session A (Writer)

Session B (Reviewer)

Implement a rate limiter for our API endpoints

Review the rate limiter implementation in @src/middleware/rateLimiter.ts. Look for edge cases, race conditions, and consistency with our existing middleware patterns.

Here's the review feedback: [Session B output]. Address these issues.

You can do something similar with tests: have one Claude write tests, then another write code to pass them.

​

Fan out across files

Loop through tasks calling

claude -p

for each. Use

--allowedTools

to scope permissions for batch operations.

For large migrations or analyses, you can distribute work across many parallel Claude invocations:

1

Generate a task list

Have Claude list all files that need migrating (e.g.,

list all 2,000 Python files that need migrating

)

2

Write a script to loop through the list

Report incorrect code

Copy

Ask AI

for

file

in

$(

cat

files.txt

);

do

claude

-p

"Migrate

$file

from React to Vue. Return OK or FAIL."

\

--allowedTools

"Edit,Bash(git commit *)"

done

3

Test on a few files, then run at scale

Refine your prompt based on what goes wrong with the first 2-3 files, then run on the full set. The...
[Truncated]

### ## Source: /docs/en/authentication
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Administration

Authentication

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Administration

Advanced installation

Authentication

Security

Server-managed settings (beta)

Data usage

Monitoring

Costs

Track team usage with analytics

Create and distribute a plugin marketplace

On this page

Authentication methods

Claude for Teams or Enterprise

Claude Console authentication

Cloud provider authentication

Credential management

See also

Administration

Authentication

Copy page

Learn how to configure user authentication and credential management for Claude Code in your organization.

Copy page

​

Authentication methods

Setting up Claude Code requires access to Anthropic models. For teams, you can set up Claude Code access in one of these ways:

Claude for Teams or Enterprise

(recommended)

Claude Console

Amazon Bedrock

Google Vertex AI

Microsoft Foundry

​

Claude for Teams or Enterprise

Claude for Teams

and

Claude for Enterprise

provide the best experience for organizations using Claude Code. Team members get access to both Claude Code and Claude on the web with centralized billing and team management.

Claude for Teams

: self-service plan with collaboration features, admin tools, and billing management. Best for smaller teams.

Claude for Enterprise

: adds SSO, domain capture, role-based permissions, compliance API, and managed policy settings for organization-wide Claude Code configurations. Best for larger organizations with security and compliance requirements.

1

Subscribe

Subscribe to

Claude for Teams

or contact sales for

Claude for Enterprise

.

2

Invite team members

Invite team members from the admin dashboard.

3

Install and log in

Team members install Claude Code and log in with their Cl...
[Truncated]

### ## Source: /docs/en/sub-agents
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Build with Claude Code

Create custom subagents

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Build with Claude Code

Create custom subagents

Run agent teams

Create plugins

Discover and install prebuilt plugins

Extend Claude with skills

Output styles

Automate with hooks

Programmatic usage

Model Context Protocol (MCP)

Troubleshooting

On this page

Built-in subagents

Quickstart: create your first subagent

Configure subagents

Use the /agents command

Choose the subagent scope

Write subagent files

Supported frontmatter fields

Choose a model

Control subagent capabilities

Available tools

Restrict which subagents can be spawned

Permission modes

Preload skills into subagents

Enable persistent memory

Conditional rules with hooks

Disable specific subagents

Define hooks for subagents

Hooks in subagent frontmatter

Project-level hooks for subagent events

Work with subagents

Understand automatic delegation

Run subagents in foreground or background

Common patterns

Isolate high-volume operations

Run parallel research

Chain subagents

Choose between subagents and main conversation

Manage subagent context

Resume subagents

Auto-compaction

Example subagents

Code reviewer

Debugger

Data scientist

Database query validator

Next steps

Build with Claude Code

Create custom subagents

Copy page

Create and use specialized AI subagents in Claude Code for task-specific workflows and improved context management.

Copy page

Subagents are specialized AI assistants that handle specific types of tasks. Each subagent runs in its own context window with a custom system prompt, specific tool access, and independent permissions. When Claude encounters a task that matches a subagent’s description, it delegates to that su...
[Truncated]

### # Block SQL write operations (case-insensitive)
if

echo

"

$COMMAND

"

|

grep

-iE

'\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b'

>

/dev/null

;

then

echo

"Blocked: Only SELECT queries are allowed"

>&2

exit

2

fi

exit

0

See

Hook input

for the complete input schema and

exit codes

for how exit codes affect behavior.

​

Disable specific subagents

You can prevent Claude from using specific subagents by adding them to the

deny

array in your

settings

. Use the format

Task(subagent-name)

where

subagent-name

matches the subagent’s name field.

Report incorrect code

Copy

Ask AI

{

"permissions"

: {

"deny"

: [

"Task(Explore)"

,

"Task(my-custom-agent)"

]

}

}

This works for both built-in and custom subagents. You can also use the

--disallowedTools

CLI flag:

Report incorrect code

Copy

Ask AI

claude

--disallowedTools

"Task(Explore)"

See

Permissions documentation

for more details on permission rules.

​

Define hooks for subagents

Subagents can define

hooks

that run during the subagent’s lifecycle. There are two ways to configure hooks:

In the subagent’s frontmatter

: Define hooks that run only while that subagent is active

In

settings.json

: Define hooks that run in the main session when subagents start or stop

​

Hooks in subagent frontmatter

Define hooks directly in the subagent’s markdown file. These hooks only run while that specific subagent is active and are cleaned up when it finishes.

All

hook events

are supported. The most common events for subagents are:

Event

Matcher input

When it fires

PreToolUse

Tool name

Before the subagent uses a tool

PostToolUse

Tool name

After the subagent uses a tool

Stop

(none)

When the subagent finishes (converted to

SubagentStop

at runtime)

This example validates Bash commands with the

PreToolUse

hook and runs a linter after file edits with

PostToolUse

:

Report incorrect code

Copy

Ask AI

---

name

:

code-reviewer

description

:

Review code changes with automatic linting

hooks

:

PreTool...
[Truncated]

### # Block write operations (case-insensitive)
if

echo

"

$COMMAND

"

|

grep

-iE

'\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE)\b'

>

/dev/null

;

then

echo

"Blocked: Write operations not allowed. Use SELECT queries only."

>&2

exit

2

fi

exit

0

Make the script executable:

Report incorrect code

Copy

Ask AI

chmod

+x

./scripts/validate-readonly-query.sh

The hook receives JSON via stdin with the Bash command in

tool_input.command

. Exit code 2 blocks the operation and feeds the error message back to Claude. See

Hooks

for details on exit codes and

Hook input

for the complete input schema.

​

Next steps

Now that you understand subagents, explore these related features:

Distribute subagents with plugins

to share subagents across teams or projects

Run Claude Code programmatically

with the Agent SDK for CI/CD and automation

Use MCP servers

to give subagents access to external tools and data

Was this page helpful?

Yes

No

Run agent teams

Claude Code Docs

home page

x

linkedin

Company

Anthropic

Careers

Economic Futures

Research

News

Trust center

Transparency

Help and security

Availability

Status

Support center

Learn

Courses

MCP connectors

Customer stories

Engineering blog

Events

Powered by Claude

Service partners

Startups program

Terms and policies

Privacy policy

Disclosure policy

Usage policy

Commercial terms

Consumer terms

Assistant

Responses are generated using AI and may contain mistakes.

---

### ## Source: /docs/en/settings
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Configuration

Claude Code settings

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Configuration

Settings

Permissions

Sandboxing

Terminal configuration

Model configuration

Speed up responses with fast mode

Memory management

Customize status line

Customize keyboard shortcuts

On this page

Configuration scopes

Available scopes

When to use each scope

How scopes interact

What uses scopes

Settings files

Available settings

Permission settings

Permission rule syntax

Sandbox settings

Attribution settings

File suggestion settings

Hook configuration

Settings precedence

Key points about the configuration system

System prompt

Excluding sensitive files

Subagent configuration

Plugin configuration

Plugin settings

enabledPlugins

extraKnownMarketplaces

strictKnownMarketplaces

Managing plugins

Environment variables

Tools available to Claude

Bash tool behavior

Extending tools with hooks

See also

Configuration

Claude Code settings

Copy page

Configure Claude Code with global and project-level settings, and environment variables.

Copy page

Claude Code offers a variety of settings to configure its behavior to meet your needs. You can configure Claude Code by running the

/config

command when using the interactive REPL, which opens a tabbed Settings interface where you can view status information and modify configuration options.

​

Configuration scopes

Claude Code uses a

scope system

to determine where configurations apply and who they’re shared with. Understanding scopes helps you decide how to configure Claude Code for personal use, team collaboration, or enterprise deployment.

​

Available scopes

Scope

Location

Who it affects

Shared with team?

Managed

System-level

managed-settings.json

All ...
[Truncated]

### # or: export MY_VAR=value
Claude Code will source this file before each Bash command, making the environment persistent across all commands.

Option 3: Use a SessionStart hook

(project-specific configuration)

Configure in

.claude/settings.json

:

Report incorrect code

Copy

Ask AI

{

"hooks"

: {

"SessionStart"

: [{

"matcher"

:

"startup"

,

"hooks"

: [{

"type"

:

"command"

,

"command"

:

"echo 'conda activate myenv' >>

\"

$CLAUDE_ENV_FILE

\"

"

}]

}]

}

}

The hook writes to

$CLAUDE_ENV_FILE

, which is then sourced before each Bash command. This is ideal for team-shared project configurations.

See

SessionStart hooks

for more details on Option 3.

​

Extending tools with hooks

You can run custom commands before or after any tool executes using

Claude Code hooks

.

For example, you could automatically run a Python formatter after Claude
modifies Python files, or prevent modifications to production configuration
files by blocking Write operations to certain paths.

​

See also

Permissions

: permission system, rule syntax, tool-specific patterns, and managed policies

Authentication

: set up user access to Claude Code

Troubleshooting

: solutions for common configuration issues

Was this page helpful?

Yes

No

Permissions

Claude Code Docs

home page

x

linkedin

Company

Anthropic

Careers

Economic Futures

Research

News

Trust center

Transparency

Help and security

Availability

Status

Support center

Learn

Courses

MCP connectors

Customer stories

Engineering blog

Events

Powered by Claude

Service partners

Startups program

Terms and policies

Privacy policy

Disclosure policy

Usage policy

Commercial terms

Consumer terms

Assistant

Responses are generated using AI and may contain mistakes.

---

### ## Source: /docs/en/third-party-integrations
Skip to main content

Claude Code Docs

home page

English

Search...

⌘

K

Ask AI

Claude Developer Platform

Claude Code on the Web

Claude Code on the Web

Search...

Navigation

Deployment

Enterprise deployment overview

Getting started

Build with Claude Code

Deployment

Administration

Configuration

Reference

Resources

Deployment

Overview

Amazon Bedrock

Google Vertex AI

Microsoft Foundry

Network configuration

LLM gateway

Development containers

On this page

Compare deployment options

Configure proxies and gateways

Amazon Bedrock

Microsoft Foundry

Google Vertex AI

Best practices for organizations

Invest in documentation and memory

Simplify deployment

Start with guided usage

Pin model versions for cloud providers

Configure security policies

Leverage MCP for integrations

Next steps

Deployment

Enterprise deployment overview

Copy page

Learn how Claude Code can integrate with various third-party services and infrastructure to meet enterprise deployment requirements.

Copy page

Organizations can deploy Claude Code through Anthropic directly or through a cloud provider. This page helps you choose the right configuration.

​

Compare deployment options

For most organizations, Claude for Teams or Claude for Enterprise provides the best experience. Team members get access to both Claude Code and Claude on the web with a single subscription, centralized billing, and no infrastructure setup required.

Claude for Teams

is self-service and includes collaboration features, admin tools, and billing management. Best for smaller teams that need to get started quickly.

Claude for Enterprise

adds SSO and domain capture, role-based permissions, compliance API access, and managed policy settings for deploying organization-wide Claude Code configurations. Best for larger organizations with security and compliance requirements.

Learn more about

Team plans

and

Enterprise plans

.

If your organization has specific infrastructure requirements, comp...
[Truncated]

### # If gateway handles GCP auth
Use

/status

in Claude Code to verify your proxy and gateway configuration is applied correctly.

​

Best practices for organizations

​

Invest in documentation and memory

We strongly recommend investing in documentation so that Claude Code understands your codebase. Organizations can deploy CLAUDE.md files at multiple levels:

Organization-wide

: Deploy to system directories like

/Library/Application Support/ClaudeCode/CLAUDE.md

(macOS) for company-wide standards

Repository-level

: Create

CLAUDE.md

files in repository roots containing project architecture, build commands, and contribution guidelines. Check these into source control so all users benefit

Learn more in

Memory and CLAUDE.md files

.

​

Simplify deployment

If you have a custom development environment, we find that creating a “one click” way to install Claude Code is key to growing adoption across an organization.

​

Start with guided usage

Encourage new users to try Claude Code for codebase Q&A, or on smaller bug fixes or feature requests. Ask Claude Code to make a plan. Check Claude’s suggestions and give feedback if it’s off-track. Over time, as users understand this new paradigm better, then they’ll be more effective at letting Claude Code run more agentically.

​

Pin model versions for cloud providers

If you deploy through

Bedrock

,

Vertex AI

, or

Foundry

, pin specific model versions using

ANTHROPIC_DEFAULT_OPUS_MODEL

,

ANTHROPIC_DEFAULT_SONNET_MODEL

, and

ANTHROPIC_DEFAULT_HAIKU_MODEL

. Without pinning, Claude Code aliases resolve to the latest version, which can break users when Anthropic releases a new model that isn’t yet enabled in your account. See

Model configuration

for details.

​

Configure security policies

Security teams can configure managed permissions for what Claude Code is and is not allowed to do, which cannot be overwritten by local configuration.

Learn more

.

​

Leverage MCP for integrations

MCP is a great way to give Claude Code more informa...
[Truncated]

