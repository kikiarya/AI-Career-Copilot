import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import {
  CareerRunInputSchema,
  EvidenceCreateSchema,
  EvidencePatchSchema
} from '@copilot/contracts';
import { createCareerRepository } from '@copilot/persistence';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env')
});

const app = express();
const repository = createCareerRepository();
const port = Number(process.env.PORT ?? 8787);
const demoUserId = process.env.LOCAL_DEMO_USER_ID ?? '00000000-0000-0000-0000-000000000001';

app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));

function getUserId(req) {
  const requested = req.header('x-demo-user-id') ?? demoUserId;
  if (process.env.NODE_ENV === 'production' && !req.header('authorization')) {
    const error = new Error('Authorization is required in production.');
    error.statusCode = 401;
    throw error;
  }
  return requested;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'api', persistence: repository.mode });
});

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function withContentHash(input) {
  const hash = createHash('sha256')
    .update(`${input.title}\n${input.content}\n${(input.skills ?? []).join('|')}`)
    .digest('hex');
  return { ...input, contentHash: hash };
}

async function resolveRunEvidence(userId, input) {
  if (input.evidenceIds.length > 0) {
    const evidence = await repository.getEvidenceByIds(userId, input.evidenceIds);
    if (evidence.length !== new Set(input.evidenceIds).size) {
      throw badRequest('One or more evidenceIds do not belong to this user.');
    }
    return evidence;
  }
  return input.evidence;
}

app.get('/api/evidence', async (req, res, next) => {
  try {
    res.json({ evidence: await repository.listEvidence(getUserId(req)) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/evidence', async (req, res, next) => {
  try {
    const input = withContentHash(EvidenceCreateSchema.parse(req.body));
    const evidence = await repository.createEvidence({ userId: getUserId(req), input });
    res.status(201).json({ evidence });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/evidence/:evidenceId', async (req, res, next) => {
  try {
    const patch = EvidencePatchSchema.parse(req.body);
    const evidence = await repository.updateEvidence(req.params.evidenceId, getUserId(req), patch);
    if (!evidence) return res.status(404).json({ error: 'evidence_not_found' });
    res.json({ evidence });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/evidence/:evidenceId', async (req, res, next) => {
  try {
    const deleted = await repository.deleteEvidence(req.params.evidenceId, getUserId(req));
    if (!deleted) return res.status(404).json({ error: 'evidence_not_found' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/career-runs', async (req, res, next) => {
  try {
    const input = CareerRunInputSchema.parse(req.body);
    const userId = getUserId(req);
    const evidenceSnapshot = await resolveRunEvidence(userId, input);
    const normalizedInput = {
      ...input,
      evidenceIds: evidenceSnapshot.map((item) => item.id),
      evidence: []
    };
    const run = await repository.createRun({
      userId,
      input: normalizedInput,
      evidenceSnapshot,
      idempotencyKey: req.header('idempotency-key') ?? randomUUID()
    });
    res.status(202).json({ runId: run.id, status: run.status, persistence: repository.mode });
  } catch (error) {
    next(error);
  }
});

app.get('/api/career-runs/:runId', async (req, res, next) => {
  try {
    const run = await repository.getRun(req.params.runId, getUserId(req));
    if (!run) return res.status(404).json({ error: 'career_run_not_found' });
    res.json(run);
  } catch (error) {
    next(error);
  }
});

app.get('/api/career-runs/:runId/events', async (req, res, next) => {
  try {
    const run = await repository.getRun(req.params.runId, getUserId(req));
    if (!run) return res.status(404).json({ error: 'career_run_not_found' });
    res.json({ events: await repository.listEvents(req.params.runId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/career-runs/:runId/cancel', async (req, res, next) => {
  try {
    const run = await repository.cancelRun(req.params.runId, getUserId(req));
    if (!run) return res.status(409).json({ error: 'career_run_not_cancellable' });
    res.json(run);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error.name === 'ZodError' ? 400 : error.statusCode ?? 500;
  res.status(status).json({
    error: status === 400 ? 'invalid_request' : 'internal_error',
    message: status === 500 ? 'The request could not be completed.' : error.message,
    issues: error.name === 'ZodError' ? error.issues : undefined
  });
});

app.listen(port, () => {
  console.log(`AI Career Copilot API listening on http://localhost:${port} (${repository.mode})`);
});
