import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareerRepository } from '../src/index.js';

const userId = '00000000-0000-0000-0000-000000000001';

const evidenceInput = {
  type: 'project',
  title: 'Agent Workbench',
  content: 'Built an evidence-grounded Agent workflow with RAG and structured output.',
  skills: ['Agent', 'RAG'],
  sourceType: 'manual',
  proofLinks: [],
  metrics: []
};

test('evidence lifecycle defaults to draft and supports confirmation', async () => {
  const repository = createCareerRepository({});
  const created = await repository.createEvidence({ userId, input: evidenceInput });
  assert.equal(created.verificationStatus, 'draft');
  assert.equal((await repository.listEvidence(userId)).length >= 1, true);

  const confirmed = await repository.updateEvidence(created.id, userId, {
    verificationStatus: 'user_confirmed'
  });
  assert.equal(confirmed.verificationStatus, 'user_confirmed');
});

test('run stores an immutable evidence snapshot and deduplicates idempotent requests', async () => {
  const repository = createCareerRepository({});
  const evidence = await repository.createEvidence({ userId, input: evidenceInput });
  const input = { jobText: 'Build an Agent application with RAG and JavaScript.', evidenceIds: [evidence.id], evidence: [] };
  const first = await repository.createRun({
    userId,
    input,
    evidenceSnapshot: [evidence],
    idempotencyKey: 'repository-test-key'
  });
  const second = await repository.createRun({
    userId,
    input,
    evidenceSnapshot: [],
    idempotencyKey: 'repository-test-key'
  });

  assert.equal(second.id, first.id);
  assert.equal(first.evidenceSnapshot[0].id, evidence.id);
});

test('local event appends preserve monotonic sequence numbers', async () => {
  const repository = createCareerRepository({});
  const run = await repository.createRun({
    userId,
    input: { jobText: 'Build an Agent application with RAG.', evidence: [], evidenceIds: [] },
    idempotencyKey: 'event-test-key'
  });
  await Promise.all(Array.from({ length: 20 }, (_, index) => repository.appendEvent({
    runId: run.id,
    type: 'step.started',
    step: `step_${index}`
  })));
  const events = await repository.listEvents(run.id);
  assert.deepEqual(events.map((event) => event.sequence), Array.from({ length: 21 }, (_, index) => index));
});
