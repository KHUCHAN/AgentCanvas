const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => ({ name, ok: true }))
    .catch((error) => ({ name, ok: false, error }));
}

async function run() {
  const cases = [
    test('Pattern assets count and schema', testPatternAssets),
    test('Pattern docs match resource ids', testPatternDocs),
    test('Agent structure parser handles fenced JSON output', testAgentStructureParser),
    test('Prompt history CRUD roundtrip', testPromptHistoryRoundtrip),
    test('Agent profile service CRUD + assignment roundtrip', testAgentProfileRoundtrip),
    test('Agent profile updates keep delegation with stale cache input', testAgentProfileStaleCachePreservesDelegation),
    test('Agent runtime cwd defaults by role', testAgentRuntimeDefaults),
    test('Agent profile runtime options persist for backend/model/policies', testAgentRuntimeOptionsRoundtrip),
    test('Interaction firewall validates communication and handoff scope', testInteractionValidationFirewall),
    test('CLI detector returns known backend entries', testCliDetectorShape),
    test('CLI invocation builder maps Claude/Codex flags', testCliInvocationBuilder),
    test('Backend profiles expose required latest models', testBackendProfilesModelCoverage),
    test('Flow store save/load/list roundtrip', testFlowStoreRoundtrip),
    test('Interaction log is appended to JSONL', testInteractionLogRoundtrip),
    test('Schedule service computes plan and patches updates', testScheduleServiceRoundtrip),
    test('Schedule service blocks cyclic/missing dependencies', testScheduleServiceBlocking),
    test('Schedule service patchTask deep-merges nested fields', testScheduleServiceDeepPatch),
    test('Run store persists summary and events', testRunStoreRoundtrip),
    test('Pin store set/get/clear roundtrip', testPinStoreRoundtrip),
    test('Sandbox + proposal workflow roundtrip', testSandboxProposalRoundtrip),
    test('Orchestrator prompt enforces NEED_HUMAN policy', testNeedHumanPromptDirective),
    test('Agent generation prompt includes role-aware model guide', testAgentGenerationModelGuidePrompt),
    test('Human query parser handles NEED_HUMAN tags', testHumanQueryParser),
    test('Task conversation extractor sorts and filters turns', testTaskConversationExtractor),
    test('Human query lifecycle events roundtrip to collab log', testHumanQueryLifecycleRoundtrip)
  ];

  const results = await Promise.all(cases);
  let failed = 0;
  for (const result of results) {
    if (result.ok) {
      console.log(`[PASS] ${result.name}`);
    } else {
      failed += 1;
      console.error(`[FAIL] ${result.name}`);
      console.error(String(result.error?.stack || result.error));
    }
  }

  if (failed > 0) {
    throw new Error(`Integration test failed (${failed} case(s))`);
  }
}

function listJsonFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

function testPatternAssets() {
  const resourcesDir = path.join(root, 'resources', 'patterns');
  const webDir = path.join(root, 'webview-ui', 'public', 'patterns');
  const resources = listJsonFiles(resourcesDir);
  const webPatterns = listJsonFiles(webDir).filter((file) => file !== 'index.json');

  assert.equal(resources.length, 20, 'resources/patterns should contain 20 pattern JSON files');
  assert.equal(webPatterns.length, 20, 'webview-ui/public/patterns should contain 20 pattern JSON files');

  for (const fileName of resources) {
    const payload = JSON.parse(fs.readFileSync(path.join(resourcesDir, fileName), 'utf8'));
    assert.ok(payload.id, `${fileName}: id is required`);
    assert.ok(Array.isArray(payload.nodes), `${fileName}: nodes should be array`);
    assert.ok(Array.isArray(payload.edges), `${fileName}: edges should be array`);
    for (const edge of payload.edges) {
      assert.equal(edge.type, 'interaction', `${fileName}: edge.type should be interaction`);
      assert.ok(edge.data, `${fileName}: edge.data required`);
      assert.ok(edge.data.termination, `${fileName}: termination required`);
      assert.ok(edge.data.termination.type, `${fileName}: termination.type required`);
    }
  }

  const index = JSON.parse(fs.readFileSync(path.join(webDir, 'index.json'), 'utf8'));
  assert.ok(Array.isArray(index), 'pattern index should be array');
  assert.equal(index.length, 20, 'pattern index should contain 20 entries');
}

function testPatternDocs() {
  const docsDir = path.join(root, 'docs', 'interaction-patterns', 'patterns');
  const resourcesDir = path.join(root, 'resources', 'patterns');
  const docIds = fs.readdirSync(docsDir).filter((name) => name.endsWith('.md')).map((name) => name.replace(/\.md$/, '')).sort();
  const resourceIds = fs.readdirSync(resourcesDir).filter((name) => name.endsWith('.json')).map((name) => name.replace(/\.json$/, '')).sort();
  assert.equal(docIds.length, 20, 'pattern docs should contain 20 files');
  assert.deepEqual(docIds, resourceIds, 'pattern docs/resource ids should match');
}

function testAgentStructureParser() {
  const { parseAgentStructure } = require(path.join(root, 'extension', 'dist', 'services', 'agentStructureParser.js'));
  const raw = [
    '```json',
    JSON.stringify({
      teamName: 'QA Team',
      teamDescription: 'Generated for QA',
      agents: [
        {
          name: 'Lead',
          role: 'orchestrator',
          isOrchestrator: true,
          delegatesTo: ['Reviewer'],
          assignedSkillIds: [],
          assignedMcpServerIds: []
        },
        {
          name: 'Reviewer',
          role: 'reviewer',
          isOrchestrator: false,
          delegatesTo: [],
          assignedSkillIds: [],
          assignedMcpServerIds: []
        }
      ],
      suggestedNewSkills: [
        {
          name: 'Implement login page',
          description: 'Build login page and connect auth',
          forAgent: 'Reviewer'
        },
        {
          name: 'API Schema Validator',
          description: 'Reusable validation for request/response contracts',
          forAgent: 'Reviewer'
        },
        {
          name: '구현 작업',
          description: '기능 구현',
          forAgent: 'Lead'
        },
        {
          name: 'api-schema-validator',
          description: 'duplicate capability',
          forAgent: 'Lead'
        }
      ],
      suggestedNewMcpServers: []
    }),
    '```'
  ].join('\n');

  const parsed = parseAgentStructure(raw);
  assert.equal(parsed.agents.length, 2, 'expected two agents');
  assert.equal(parsed.agents[0].isOrchestrator, true, 'first agent should be orchestrator');
  assert.equal(parsed.suggestedNewSkills.length, 1, 'task-like or duplicate suggested skills should be filtered');
  assert.equal(parsed.suggestedNewSkills[0].name, 'api-schema-validator');
  assert.equal(parsed.suggestedNewSkills[0].forAgent, 'Reviewer');
}

async function testPromptHistoryRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-history-'));
  try {
    const {
      appendPromptHistory,
      readPromptHistory,
      removePromptHistory,
      findPromptHistory,
      markPromptHistoryApplied
    } = require(path.join(root, 'extension', 'dist', 'services', 'promptHistory.js'));

    const created = await appendPromptHistory({
      workspaceRoot: tmpRoot,
      prompt: 'build team',
      backendId: 'auto',
      result: {
        teamName: 'Team',
        teamDescription: 'Desc',
        agents: [
          {
            name: 'Lead',
            role: 'orchestrator',
            isOrchestrator: true,
            delegatesTo: [],
            assignedSkillIds: [],
            assignedMcpServerIds: []
          }
        ],
        suggestedNewSkills: [],
        suggestedNewMcpServers: []
      },
      applied: false
    });

    const loaded = await readPromptHistory(tmpRoot);
    assert.equal(loaded.length, 1, 'history should contain one entry');
    assert.equal(loaded[0].id, created.id, 'history id mismatch');

    await markPromptHistoryApplied(tmpRoot, created.id, true);
    const found = await findPromptHistory(tmpRoot, created.id);
    assert.equal(found?.applied, true, 'history applied flag should be true');

    await removePromptHistory(tmpRoot, created.id);
    const afterDelete = await readPromptHistory(tmpRoot);
    assert.equal(afterDelete.length, 0, 'history should be empty after delete');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testAgentProfileRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-profiles-'));
  try {
    const {
      createCustomAgentProfile,
      listCustomAgentProfiles,
      applyAgentProfilePatch,
      assignSkillToAgent,
      assignMcpToAgent,
      setAgentDelegation,
      deleteAgentProfile
    } = require(path.join(root, 'extension', 'dist', 'services', 'agentProfileService.js'));

    const created = await createCustomAgentProfile({
      workspaceRoot: tmpRoot,
      homeDir: tmpRoot,
      name: 'Integration Agent',
      role: 'coder',
      isOrchestrator: false
    });

    const patched = await applyAgentProfilePatch({
      workspaceRoot: tmpRoot,
      baseProfile: created,
      patch: {
        description: 'Roundtrip profile'
      }
    });

    const withSkill = await assignSkillToAgent({
      workspaceRoot: tmpRoot,
      agent: patched,
      skillId: 'skill:integration'
    });

    const withMcp = await assignMcpToAgent({
      workspaceRoot: tmpRoot,
      agent: withSkill,
      mcpServerId: 'mcp:integration'
    });

    await setAgentDelegation({
      workspaceRoot: tmpRoot,
      agent: withMcp,
      workerIds: ['worker-1']
    });

    const listed = await listCustomAgentProfiles(tmpRoot);
    assert.equal(listed.length, 1, 'expected one custom profile');
    assert.equal(listed[0].description, 'Roundtrip profile');
    assert.ok((listed[0].assignedSkillIds ?? []).includes('skill:integration'));
    assert.ok((listed[0].assignedMcpServerIds ?? []).includes('mcp:integration'));

    await deleteAgentProfile(tmpRoot, listed[0].id);
    const afterDelete = await listCustomAgentProfiles(tmpRoot);
    assert.equal(afterDelete.length, 0, 'profile should be deleted');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testAgentProfileStaleCachePreservesDelegation() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-stale-profile-'));
  try {
    const {
      createCustomAgentProfile,
      setAgentDelegation,
      assignSkillToAgent,
      assignMcpToAgent,
      listCustomAgentProfiles
    } = require(path.join(root, 'extension', 'dist', 'services', 'agentProfileService.js'));

    const created = await createCustomAgentProfile({
      workspaceRoot: tmpRoot,
      homeDir: tmpRoot,
      name: 'Stale Cache Agent',
      role: 'orchestrator',
      isOrchestrator: true
    });

    await setAgentDelegation({
      workspaceRoot: tmpRoot,
      agent: created,
      workerIds: ['worker-a', 'worker-b']
    });

    // Intentionally pass the stale profile from phase 1 to reproduce the missing-edge regression.
    await assignSkillToAgent({
      workspaceRoot: tmpRoot,
      agent: created,
      skillId: 'skill:stale'
    });
    await assignMcpToAgent({
      workspaceRoot: tmpRoot,
      agent: created,
      mcpServerId: 'mcp:stale'
    });

    const listed = await listCustomAgentProfiles(tmpRoot);
    assert.equal(listed.length, 1, 'expected one profile after stale-cache updates');
    assert.deepEqual(listed[0].delegatesTo, ['worker-a', 'worker-b'], 'delegation should survive stale-cache updates');
    assert.ok((listed[0].assignedSkillIds ?? []).includes('skill:stale'));
    assert.ok((listed[0].assignedMcpServerIds ?? []).includes('mcp:stale'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testAgentRuntimeDefaults() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-runtime-'));
  try {
    const { createCustomAgentProfile } = require(
      path.join(root, 'extension', 'dist', 'services', 'agentProfileService.js')
    );

    const worker = await createCustomAgentProfile({
      workspaceRoot: tmpRoot,
      homeDir: tmpRoot,
      name: 'Worker Agent',
      role: 'coder',
      isOrchestrator: false
    });
    assert.equal(worker.runtime?.kind, 'cli');
    assert.equal(worker.runtime?.cwdMode, 'agentHome');

    const orchestrator = await createCustomAgentProfile({
      workspaceRoot: tmpRoot,
      homeDir: tmpRoot,
      name: 'Orchestrator Agent',
      role: 'orchestrator',
      isOrchestrator: true
    });
    assert.equal(orchestrator.runtime?.kind, 'cli');
    assert.equal(orchestrator.runtime?.cwdMode, 'workspace');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testAgentRuntimeOptionsRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-runtime-options-'));
  try {
    const {
      createCustomAgentProfile,
      applyAgentProfilePatch,
      listCustomAgentProfiles
    } = require(path.join(root, 'extension', 'dist', 'services', 'agentProfileService.js'));

    const created = await createCustomAgentProfile({
      workspaceRoot: tmpRoot,
      homeDir: tmpRoot,
      name: 'Runtime Options Agent',
      role: 'coder',
      backendId: 'codex',
      modelId: 'gpt-4.1',
      codexApproval: 'on-request',
      codexSandbox: 'workspace-write',
      additionalDirs: ['/tmp/shared'],
      enableWebSearch: true,
      sessionId: 'session-123'
    });

    const updated = await applyAgentProfilePatch({
      workspaceRoot: tmpRoot,
      baseProfile: created,
      patch: {
        runtime: {
          kind: 'cli',
          backendId: 'claude',
          cwdMode: 'workspace',
          modelId: 'claude-sonnet-4-5-20250929',
          promptMode: 'append',
          maxTurns: 6,
          maxBudgetUsd: 3.5,
          permissionMode: 'plan',
          allowedTools: ['Read', 'Grep']
        }
      }
    });

    assert.equal(updated.runtime?.kind, 'cli');
    assert.equal(updated.runtime?.backendId, 'claude');
    assert.equal(updated.runtime?.modelId, 'claude-sonnet-4-5-20250929');
    assert.equal(updated.runtime?.maxTurns, 6);
    assert.equal(updated.runtime?.maxBudgetUsd, 3.5);
    assert.equal(updated.runtime?.permissionMode, 'plan');
    assert.deepEqual(updated.runtime?.allowedTools, ['Read', 'Grep']);

    const listed = await listCustomAgentProfiles(tmpRoot);
    assert.equal(listed.length, 1, 'expected one runtime-options profile');
    assert.equal(listed[0].runtime?.kind, 'cli');
    assert.equal(listed[0].runtime?.backendId, 'claude');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function testCliInvocationBuilder() {
  const { buildCliInvocation } = require(path.join(root, 'extension', 'dist', 'services', 'cliExecutor.js'));

  const claudeInvocation = buildCliInvocation({
    backend: {
      id: 'claude',
      displayName: 'Claude',
      command: 'claude',
      args: [],
      available: true,
      stdinPrompt: true
    },
    prompt: 'hello',
    modelId: 'claude-sonnet-4-5-20250929',
    runtime: {
      kind: 'cli',
      backendId: 'claude',
      promptMode: 'append',
      maxTurns: 3,
      maxBudgetUsd: 2.5,
      permissionMode: 'plan',
      allowedTools: ['Read']
    },
    systemPrompt: 'Always respond in English.'
  });

  assert.equal(claudeInvocation.command, 'claude');
  assert.ok(claudeInvocation.args.includes('--output-format'));
  assert.ok(claudeInvocation.args.includes('stream-json'));
  assert.ok(claudeInvocation.args.includes('--max-turns'));
  assert.ok(claudeInvocation.args.includes('--max-budget-usd'));
  assert.ok(claudeInvocation.args.includes('--permission-mode'));
  assert.ok(claudeInvocation.args.includes('plan'));
  assert.ok(claudeInvocation.args.includes('--append-system-prompt'));

  const codexInvocation = buildCliInvocation({
    backend: {
      id: 'codex',
      displayName: 'Codex',
      command: 'codex',
      args: [],
      available: true,
      stdinPrompt: true
    },
    prompt: 'fix tests',
    modelId: 'gpt-4.1',
    runtime: {
      kind: 'cli',
      backendId: 'codex',
      codexApproval: 'on-request',
      codexSandbox: 'workspace-write',
      additionalDirs: ['/tmp/a', '/tmp/b'],
      enableWebSearch: true,
      sessionId: 'sess-001'
    }
  });

  assert.equal(codexInvocation.command, 'codex');
  assert.equal(codexInvocation.args[0], 'exec');
  assert.ok(codexInvocation.args.includes('--json'));
  assert.ok(codexInvocation.args.includes('--ask-for-approval'));
  assert.ok(codexInvocation.args.includes('on-request'));
  assert.ok(codexInvocation.args.includes('--sandbox'));
  assert.ok(codexInvocation.args.includes('workspace-write'));
  assert.ok(codexInvocation.args.includes('--add-dir'));
  assert.ok(codexInvocation.args.includes('--search'));
}

function testBackendProfilesModelCoverage() {
  const { BACKEND_PROFILES } = require(path.join(root, 'extension', 'dist', 'services', 'backendProfiles.js'));
  const byBackend = new Map(BACKEND_PROFILES.map((profile) => [profile.backendId, profile]));

  const claudeModels = new Set((byBackend.get('claude')?.models || []).map((model) => model.id));
  const codexModels = new Set((byBackend.get('codex')?.models || []).map((model) => model.id));
  const geminiModels = new Set((byBackend.get('gemini')?.models || []).map((model) => model.id));

  assert.ok(claudeModels.has('claude-sonnet-4-6'), 'claude sonnet 4.6 should exist');
  assert.ok(claudeModels.has('claude-opus-4-6'), 'claude opus 4.6 should exist');
  assert.ok(claudeModels.has('claude-haiku-4-5-20251001'), 'claude haiku 4.5 fallback should exist');
  assert.ok(codexModels.has('gpt-4.1'), 'codex gpt-4.1 fallback should exist');
  assert.ok(
    [...codexModels].some((id) => id.startsWith('gpt-5')),
    'codex should expose at least one gpt-5 family model'
  );
  assert.ok(geminiModels.has('gemini-3-pro-preview'), 'gemini 3 pro preview should exist');
  assert.ok(geminiModels.has('gemini-3-flash-preview'), 'gemini 3 flash preview should exist');
  assert.ok(geminiModels.has('gemini-2.5-pro'), 'gemini 2.5 pro fallback should exist');
  assert.ok(geminiModels.has('gemini-2.5-flash'), 'gemini 2.5 flash fallback should exist');
  assert.ok(geminiModels.has('gemini-2.5-flash-lite'), 'gemini 2.5 flash-lite should exist');
  assert.equal(geminiModels.has('gemini-2.0-flash'), false, 'gemini 2.0 flash should not be present');
  assert.equal(geminiModels.has('gemini-2.0-flash-lite'), false, 'gemini 2.0 flash-lite should not be present');
}

function testInteractionValidationFirewall() {
  const {
    assertDirectedCommunicationAllowed,
    assertValidHandoffEnvelope,
    assertHandoffPathsWithinScope
  } = require(path.join(root, 'extension', 'dist', 'services', 'interactionValidation.js'));

  const edges = [
    { id: 'e1', source: 'agent:orch', target: 'agent:worker-a', type: 'delegates' },
    { id: 'e2', source: 'agent:worker-a', target: 'agent:worker-b', type: 'interaction' }
  ];

  assert.doesNotThrow(() =>
    assertDirectedCommunicationAllowed({
      edges,
      fromAgentId: 'agent:orch',
      toAgentId: 'agent:worker-a'
    })
  );
  assert.throws(
    () =>
      assertDirectedCommunicationAllowed({
        edges,
        fromAgentId: 'agent:worker-b',
        toAgentId: 'agent:orch'
      }),
    /not allowed/
  );

  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-handoff-scope-'));
  try {
    const sandboxRootDir = path.join(workspaceRoot, '.agentcanvas', 'sandboxes', 'run_1', 'agent_x');
    const validHandoff = {
      intent: 'Submit proposal for orchestrator review',
      sandboxWorkDir: path.join(sandboxRootDir, 'work'),
      proposalJson: path.join(sandboxRootDir, 'work', 'proposal', 'proposal.json'),
      changedFiles: ['src/index.ts'],
      inputs: ['task.md']
    };

    assert.doesNotThrow(() => assertValidHandoffEnvelope({ handoff: validHandoff }));
    assert.doesNotThrow(() =>
      assertHandoffPathsWithinScope({
        handoff: validHandoff,
        workspaceRoot,
        sandboxRootDir
      })
    );

    assert.throws(
      () =>
        assertValidHandoffEnvelope({
          handoff: {
            ...validHandoff,
            changedFiles: []
          }
        }),
      /changedFiles/
    );

    assert.throws(
      () =>
        assertHandoffPathsWithinScope({
          handoff: {
            ...validHandoff,
            proposalJson: path.join(workspaceRoot, 'proposal.json')
          },
          workspaceRoot,
          sandboxRootDir
        }),
      /sandboxWorkDir/
    );

    assert.throws(
      () =>
        assertHandoffPathsWithinScope({
          handoff: {
            ...validHandoff,
            changedFiles: ['../escape.ts']
          },
          workspaceRoot,
          sandboxRootDir
        }),
      /escapes workspace/
    );
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

async function testCliDetectorShape() {
  const { detectAllCliBackends } = require(path.join(root, 'extension', 'dist', 'services', 'cliDetector.js'));
  const backends = await detectAllCliBackends();
  assert.ok(Array.isArray(backends), 'backends should be array');
  assert.ok(backends.some((backend) => backend.id === 'auto'), 'auto backend must exist');
  assert.ok(
    backends.some((backend) => backend.id === 'claude' || backend.id === 'claude-code'),
    'claude backend must exist'
  );
}

async function testFlowStoreRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-flow-'));
  try {
    const { saveFlow, loadFlow, listFlows } = require(path.join(root, 'extension', 'dist', 'services', 'flowStore.js'));
    await saveFlow({
      workspaceRoot: tmpRoot,
      flowName: 'Integration Flow',
      nodes: [
        {
          id: 'n1',
          type: 'system',
          position: { x: 0, y: 0 },
          data: { name: 'Router' }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n1',
          type: 'interaction',
          data: {
            patternId: 'self-test',
            topology: 'p2p',
            messageForm: 'structured_json',
            sync: 'req_res',
            termination: { type: 'max_rounds', rounds: 1 },
            params: {},
            observability: { logs: true, traces: false, retain_days: 7 }
          }
        }
      ]
    });

    const names = await listFlows(tmpRoot);
    assert.ok(names.includes('integration-flow'));

    const loaded = await loadFlow({
      workspaceRoot: tmpRoot,
      flowName: 'integration-flow'
    });
    assert.equal(loaded.nodes.length, 1);
    assert.equal(loaded.edges.length, 1);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testInteractionLogRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-log-'));
  try {
    const { logInteractionEvent } = require(path.join(root, 'extension', 'dist', 'services', 'flowStore.js'));
    const filePath = await logInteractionEvent({
      workspaceRoot: tmpRoot,
      flowName: 'Integration Flow',
      interactionId: 'manager_worker',
      edgeId: 'e1',
      event: 'configured',
      data: { rounds: 2 }
    });

    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\\n').filter(Boolean);
    assert.ok(lines.length >= 1, 'expected at least one log line');
    const row = JSON.parse(lines[lines.length - 1]);
    assert.equal(row.event, 'configured');
    assert.equal(row.interactionId, 'manager_worker');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testScheduleServiceRoundtrip() {
  const { ScheduleService } = require(path.join(root, 'extension', 'dist', 'schedule', 'scheduleService.js'));
  const service = new ScheduleService({ defaultEstimateMs: 60000 });
  const runId = 'run_schedule_test';
  const events = [];
  const unsubscribe = service.subscribe(runId, (event) => {
    events.push(event);
  });

  service.createRun(runId, [
    {
      id: 'task:1',
      title: 'A',
      agentId: 'agent:1',
      deps: [],
      status: 'planned',
      estimateMs: 120000,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now()
    },
    {
      id: 'task:2',
      title: 'B',
      agentId: 'agent:1',
      deps: ['task:1'],
      status: 'planned',
      estimateMs: 120000,
      createdAtMs: Date.now() + 1,
      updatedAtMs: Date.now() + 1
    }
  ]);

  const tasks = service.getTasks(runId);
  assert.equal(tasks.length, 2);
  const first = tasks.find((task) => task.id === 'task:1');
  const second = tasks.find((task) => task.id === 'task:2');
  assert.ok(first, 'first task should exist');
  assert.ok(second, 'second task should exist');
  assert.equal(first.plannedStartMs, 0);
  assert.ok((second.plannedStartMs || 0) >= (first.plannedEndMs || 0), 'second task should start after first');

  service.patchTask(runId, 'task:1', { overrides: { pinned: true } });
  const updated = service.getTasks(runId).find((task) => task.id === 'task:1');
  assert.equal(updated?.overrides?.pinned, true);

  assert.ok(events.length > 0, 'expected schedule events to be emitted');
  unsubscribe();
}

async function testScheduleServiceBlocking() {
  const { ScheduleService } = require(path.join(root, 'extension', 'dist', 'schedule', 'scheduleService.js'));
  const service = new ScheduleService({ defaultEstimateMs: 60000 });
  const runId = 'run_schedule_blocking_test';
  const now = Date.now();
  service.createRun(runId, [
    {
      id: 'task:cycle:a',
      title: 'Cycle A',
      agentId: 'agent:1',
      deps: ['task:cycle:b'],
      status: 'planned',
      createdAtMs: now,
      updatedAtMs: now
    },
    {
      id: 'task:cycle:b',
      title: 'Cycle B',
      agentId: 'agent:1',
      deps: ['task:cycle:a'],
      status: 'planned',
      createdAtMs: now + 1,
      updatedAtMs: now + 1
    },
    {
      id: 'task:missing',
      title: 'Missing dependency',
      agentId: 'agent:2',
      deps: ['task:not-found'],
      status: 'planned',
      createdAtMs: now + 2,
      updatedAtMs: now + 2
    }
  ]);

  const tasks = service.getTasks(runId);
  const cycleA = tasks.find((task) => task.id === 'task:cycle:a');
  const cycleB = tasks.find((task) => task.id === 'task:cycle:b');
  const missing = tasks.find((task) => task.id === 'task:missing');

  assert.equal(cycleA?.status, 'blocked');
  assert.equal(cycleB?.status, 'blocked');
  assert.equal(missing?.status, 'blocked');
  assert.ok((missing?.blocker?.message || '').includes('task:not-found'));
}

async function testScheduleServiceDeepPatch() {
  const { ScheduleService } = require(path.join(root, 'extension', 'dist', 'schedule', 'scheduleService.js'));
  const service = new ScheduleService({ defaultEstimateMs: 60000 });
  const runId = 'run_schedule_patch_test';
  const now = Date.now();
  service.createRun(runId, [
    {
      id: 'task:patch',
      title: 'Patch target',
      agentId: 'agent:1',
      deps: [],
      status: 'planned',
      overrides: {
        pinned: true,
        priority: 3
      },
      meta: {
        customData: {
          keep: true,
          replace: 'before'
        }
      },
      createdAtMs: now,
      updatedAtMs: now
    }
  ]);

  service.patchTask(runId, 'task:patch', {
    overrides: {
      forceStartMs: 123
    },
    meta: {
      customData: {
        replace: 'after'
      }
    }
  });

  const updated = service.getTasks(runId).find((task) => task.id === 'task:patch');
  assert.equal(updated?.overrides?.pinned, true);
  assert.equal(updated?.overrides?.priority, 3);
  assert.equal(updated?.overrides?.forceStartMs, 123);
  assert.equal(updated?.meta?.customData?.keep, true);
  assert.equal(updated?.meta?.customData?.replace, 'after');
}

async function testRunStoreRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-runs-'));
  try {
    const { startRun, appendRunEvent, finishRun, listRuns, loadRunEvents } = require(
      path.join(root, 'extension', 'dist', 'services', 'runStore.js')
    );
    const run = await startRun({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      backendId: 'auto',
      runName: 'integration'
    });
    await appendRunEvent({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      event: {
        ts: Date.now(),
        flow: 'default',
        runId: run.runId,
        type: 'node_started',
        nodeId: 'agent:lead'
      }
    });
    await finishRun({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      runId: run.runId,
      status: 'success'
    });

    const runs = await listRuns({ workspaceRoot: tmpRoot, flowName: 'default' });
    assert.ok(runs.length >= 1, 'expected at least one run summary');
    assert.equal(runs[0].runId, run.runId);

    const events = await loadRunEvents({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      runId: run.runId
    });
    assert.ok(events.some((event) => event.type === 'run_started'));
    assert.ok(events.some((event) => event.type === 'run_finished'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testPinStoreRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-pins-'));
  try {
    const { setPin, getPin, clearPin, listPins } = require(
      path.join(root, 'extension', 'dist', 'services', 'pinStore.js')
    );
    await setPin({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      nodeId: 'node:1',
      output: { value: 42 }
    });
    const pin = await getPin({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      nodeId: 'node:1'
    });
    assert.ok(pin, 'pin should exist');
    assert.equal(pin.output.value, 42);

    const pins = await listPins({
      workspaceRoot: tmpRoot,
      flowName: 'default'
    });
    assert.equal(pins.length, 1);

    await clearPin({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      nodeId: 'node:1'
    });
    const after = await getPin({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      nodeId: 'node:1'
    });
    assert.equal(after, undefined);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

async function testSandboxProposalRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-proposal-'));
  try {
    fs.mkdirSync(path.join(tmpRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'src', 'demo.txt'), 'before\n', 'utf8');
    fs.mkdirSync(path.join(tmpRoot, '.agentcanvas'), { recursive: true });

    const { prepareSandbox } = require(path.join(root, 'extension', 'dist', 'services', 'sandboxService.js'));
    const { createProposal, applyProposal } = require(
      path.join(root, 'extension', 'dist', 'services', 'proposalService.js')
    );

    const runId = 'run_sandbox_test';
    const agentId = 'custom:worker';
    const sandbox = await prepareSandbox({
      workspaceRoot: tmpRoot,
      runId,
      agentId,
      files: ['src/demo.txt']
    });

    assert.ok(fs.existsSync(path.join(sandbox.inputDir, 'src', 'demo.txt')));
    assert.ok(fs.existsSync(path.join(sandbox.workDir, 'src', 'demo.txt')));

    fs.writeFileSync(path.join(sandbox.workDir, 'src', 'demo.txt'), 'after\n', 'utf8');

    const proposal = await createProposal({
      workspaceRoot: tmpRoot,
      runId,
      agentId,
      allowedFiles: sandbox.copiedFiles,
      gitHead: sandbox.gitHead
    });

    assert.equal(proposal.hasChanges, true);
    assert.ok(proposal.changedFiles.some((item) => item.path === 'src/demo.txt'));

    const applied = await applyProposal({
      workspaceRoot: tmpRoot,
      runId,
      agentId
    });
    assert.equal(applied.applied, true);
    assert.equal(fs.readFileSync(path.join(tmpRoot, 'src', 'demo.txt'), 'utf8'), 'after\n');

    await assert.rejects(
      () =>
        prepareSandbox({
          workspaceRoot: tmpRoot,
          runId: 'run_sandbox_bad',
          agentId,
          files: ['../secret.txt']
        }),
      /Path traversal|Invalid sandbox path|Absolute path/
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function testNeedHumanPromptDirective() {
  const { buildCachedPrompt } = require(path.join(root, 'extension', 'dist', 'services', 'promptBuilder.js'));

  const orchestratorPrompt = buildCachedPrompt({
    flowName: 'default',
    taskInstruction: 'Collect requirements',
    agent: {
      id: 'agent:orch',
      name: 'Orchestrator',
      role: 'orchestrator',
      roleLabel: 'Orchestrator',
      description: 'lead',
      systemPrompt: '',
      isOrchestrator: true
    }
  }).prompt;

  const workerPrompt = buildCachedPrompt({
    flowName: 'default',
    taskInstruction: 'Implement feature',
    agent: {
      id: 'agent:worker',
      name: 'Worker',
      role: 'coder',
      roleLabel: 'Coder',
      description: 'worker',
      systemPrompt: '',
      isOrchestrator: false
    }
  }).prompt;

  assert.ok(
    orchestratorPrompt.includes('[NEED_HUMAN: <question>]'),
    'orchestrator prompt should include NEED_HUMAN format'
  );
  assert.ok(
    orchestratorPrompt.includes('Do not use alternative query tags'),
    'orchestrator prompt should prohibit alternate human-query formats'
  );
  assert.equal(
    workerPrompt.includes('[NEED_HUMAN: <question>]'),
    false,
    'worker prompt must not include NEED_HUMAN directive'
  );
}

function testAgentGenerationModelGuidePrompt() {
  const { BACKEND_PROFILES } = require(path.join(root, 'extension', 'dist', 'services', 'backendProfiles.js'));
  const { buildAgentGenerationPrompt } = require(path.join(root, 'extension', 'dist', 'services', 'promptBuilder.js'));

  const prompt = buildAgentGenerationPrompt({
    userPrompt: 'Build a team for coding, review, and research.',
    existingAgents: [],
    existingSkills: [],
    existingMcpServers: [],
    backendProfiles: BACKEND_PROFILES,
    useSmartAssignment: true
  });

  assert.ok(
    prompt.includes('Role-aware model selection guide'),
    'generation prompt should include role-aware model guide section'
  );
  assert.ok(
    prompt.includes('Latest frontier agentic coding model.'),
    'generation prompt should include codex model guidance text'
  );
  assert.ok(
    prompt.includes('Most capable for complex work'),
    'generation prompt should include claude model guidance text'
  );
  assert.ok(
    prompt.includes('assignedModel must be selected from the listed model guide'),
    'generation prompt should enforce assignedModel selection rule'
  );
}

function testHumanQueryParser() {
  const { parseHumanQuery } = require(path.join(root, 'extension', 'dist', 'services', 'humanQuery.js'));

  const tagged = parseHumanQuery('Execution blocked. [NEED_HUMAN: Which API key should I use?]');
  assert.equal(tagged?.question, 'Which API key should I use?');

  const legacy = parseHumanQuery('[NEED_HUMAN] Confirm staging vs production target');
  assert.equal(legacy?.question, 'Confirm staging vs production target');

  const malformed = parseHumanQuery('[NEED_HUMAN:]');
  assert.equal(malformed, undefined);

  const none = parseHumanQuery('No human input required');
  assert.equal(none, undefined);
}

function testTaskConversationExtractor() {
  const { extractTaskConversationTurns } = require(
    path.join(root, 'extension', 'dist', 'services', 'taskConversation.js')
  );

  const runId = 'run_conversation_test';
  const taskId = 'task:alpha';
  const turns = extractTaskConversationTurns(
    [
      {
        ts: 300,
        runId,
        flow: 'default',
        type: 'run_log',
        message: 'task_conversation_turn',
        meta: {
          taskId,
          role: 'agent',
          agentId: 'agent:worker',
          content: 'Here is the implementation result.'
        }
      },
      {
        ts: 100,
        runId,
        flow: 'default',
        type: 'run_log',
        message: 'task_conversation_turn',
        meta: {
          taskId,
          role: 'orchestrator',
          agentId: 'agent:orch',
          content: 'Implement the parser and include tests.'
        }
      },
      {
        ts: 120,
        runId,
        flow: 'default',
        type: 'run_log',
        message: 'task_conversation_turn',
        meta: {
          taskId: 'task:other',
          role: 'orchestrator',
          content: 'Different task should be filtered.'
        }
      },
      {
        ts: 140,
        runId,
        flow: 'default',
        type: 'run_log',
        message: 'task_conversation_turn',
        meta: {
          taskId,
          role: 'agent',
          content: '   '
        }
      }
    ],
    runId,
    taskId
  );

  assert.equal(turns.length, 2, 'only target task turns with non-empty content should remain');
  assert.equal(turns[0].role, 'orchestrator');
  assert.equal(turns[1].role, 'agent');
  assert.ok(turns[0].timestamp < turns[1].timestamp, 'turns should be sorted by timestamp');
}

async function testHumanQueryLifecycleRoundtrip() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentcanvas-human-query-'));
  try {
    const { appendCollabEvent, readCollabEvents } = require(
      path.join(root, 'extension', 'dist', 'services', 'collaborationLogger.js')
    );

    await appendCollabEvent({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      runId: 'run_human_query',
      event: 'human_query_requested',
      actor: 'orchestrator',
      provenance: 'system',
      payload: {
        taskId: 'task:qa',
        question: 'Which deployment target should I use?'
      }
    });
    await appendCollabEvent({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      runId: 'run_human_query',
      event: 'human_query_answered',
      actor: 'user',
      provenance: 'user_input',
      payload: {
        taskId: 'task:qa',
        answer: 'Use staging first.'
      }
    });
    await appendCollabEvent({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      runId: 'run_human_query',
      event: 'task_resumed_after_human_query',
      actor: 'orchestrator',
      provenance: 'system',
      payload: {
        taskId: 'task:qa'
      }
    });

    const events = await readCollabEvents({
      workspaceRoot: tmpRoot,
      flowName: 'default',
      runId: 'run_human_query'
    });
    const eventTypes = events.map((item) => item.event);
    assert.deepEqual(eventTypes, [
      'human_query_requested',
      'human_query_answered',
      'task_resumed_after_human_query'
    ]);
    assert.equal(events[1]?.payload?.answer, 'Use staging first.');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
