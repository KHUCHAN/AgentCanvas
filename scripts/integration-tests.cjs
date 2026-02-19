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
    test('Agent runtime cwd defaults by role', testAgentRuntimeDefaults),
    test('CLI detector returns known backend entries', testCliDetectorShape),
    test('Flow store save/load/list roundtrip', testFlowStoreRoundtrip),
    test('Interaction log is appended to JSONL', testInteractionLogRoundtrip),
    test('Schedule service computes plan and patches updates', testScheduleServiceRoundtrip),
    test('Schedule service blocks cyclic/missing dependencies', testScheduleServiceBlocking),
    test('Schedule service patchTask deep-merges nested fields', testScheduleServiceDeepPatch),
    test('Run store persists summary and events', testRunStoreRoundtrip),
    test('Pin store set/get/clear roundtrip', testPinStoreRoundtrip),
    test('Sandbox + proposal workflow roundtrip', testSandboxProposalRoundtrip)
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
      suggestedNewSkills: [],
      suggestedNewMcpServers: []
    }),
    '```'
  ].join('\n');

  const parsed = parseAgentStructure(raw);
  assert.equal(parsed.agents.length, 2, 'expected two agents');
  assert.equal(parsed.agents[0].isOrchestrator, true, 'first agent should be orchestrator');
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

async function testCliDetectorShape() {
  const { detectAllCliBackends } = require(path.join(root, 'extension', 'dist', 'services', 'cliDetector.js'));
  const backends = await detectAllCliBackends();
  assert.ok(Array.isArray(backends), 'backends should be array');
  assert.ok(backends.some((backend) => backend.id === 'auto'), 'auto backend must exist');
  assert.ok(backends.some((backend) => backend.id === 'claude-code'), 'claude backend must exist');
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
          data: { termination: { type: 'max_rounds', rounds: 1 } }
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

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
