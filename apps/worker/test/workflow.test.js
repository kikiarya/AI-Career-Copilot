import test from 'node:test';
import assert from 'node:assert/strict';
import { createCareerRepository } from '@copilot/persistence';
import { runCareerWorkflow } from '../src/workflow.js';

const userId = '00000000-0000-0000-0000-000000000001';

test('workflow produces an evidence-grounded report and traceable steps', async () => {
  const repository = createCareerRepository({});
  const run = await repository.createRun({
    userId,
    input: {
      jobText: 'Build RAG and LangGraph applications with JavaScript and Docker.',
      evidence: [{
        id: 'evidence_1',
        type: 'project',
        title: 'Agent workbench',
        content: 'Built a JavaScript Agent workflow with RAG and Tool Calling.',
        skills: ['JavaScript', 'RAG', 'LangGraph'],
        sourceType: 'manual',
        verificationStatus: 'user_confirmed',
        proofLinks: [],
        metrics: []
      }]
    }
  });

  const output = await runCareerWorkflow({ run, repository });
  const events = await repository.listEvents(run.id);

  assert.equal(output.matchReport.totalScore > 0, true);
  assert.deepEqual(output.artifactDraft.evidenceRefs, ['evidence_1']);
  assert.equal(events.filter((event) => event.type === 'step.started').length, 5);
  assert.equal(events.filter((event) => event.type === 'step.completed').length, 5);
});

test('workflow does not use draft evidence in generated materials', async () => {
  const repository = createCareerRepository({});
  const run = await repository.createRun({
    userId,
    input: {
      jobText: 'Build RAG applications with Python.',
      evidence: [{
        id: 'draft_1',
        type: 'project',
        title: 'Unconfirmed project',
        content: 'Worked with RAG.',
        skills: ['RAG'],
        sourceType: 'resume_paste',
        verificationStatus: 'draft',
        proofLinks: [],
        metrics: []
      }]
    }
  });

  const output = await runCareerWorkflow({ run, repository });
  assert.deepEqual(output.artifactDraft.evidenceRefs, []);
  assert.equal(output.artifactDraft.unsupportedClaims.length, 1);
});
