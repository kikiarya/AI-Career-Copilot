import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createCareerRepository } from '@copilot/persistence';
import { createModelGateway } from '@copilot/model-gateway';
import { runCareerWorkflow } from './workflow.js';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env')
});

const repository = createCareerRepository();
const modelGateway = createModelGateway();
const pollMs = Number(process.env.WORKER_POLL_MS ?? 1500);
const leaseSeconds = Number(process.env.WORKER_LEASE_SECONDS ?? 300);
const maxAttempts = Number(process.env.WORKFLOW_MAX_ATTEMPTS ?? 3);
let polling = false;

async function processNext() {
  if (polling || repository.mode !== 'supabase') return;
  polling = true;
  try {
    const recoveredRuns = await repository.requeueStaleRuns(maxAttempts);
    for (const recovered of recoveredRuns) {
      await repository.appendEvent({
        runId: recovered.id,
        type: recovered.status === 'failed' ? 'run.failed' : 'run.recovered',
        payload: {
          reason: 'worker_lease_expired',
          attemptCount: recovered.attemptCount,
          status: recovered.status
        }
      });
    }

    const run = await repository.claimNextRun(leaseSeconds);
    if (!run) return;
    const heartbeat = setInterval(() => {
      repository.heartbeatRun(run.id, leaseSeconds).catch((error) => {
        console.error(`Career Run ${run.id} heartbeat failed`, error.message);
      });
    }, Math.max(1000, Math.floor(leaseSeconds * 1000 / 3)));
    heartbeat.unref?.();
    try {
      const output = await runCareerWorkflow({ run, repository, gateway: modelGateway });
      const updated = await repository.updateRun(run.id, {
        status: 'completed',
        output,
        completedAt: new Date().toISOString(),
        leaseUntil: null,
        heartbeatAt: null
      }, { expectedStatus: 'running' });
      if (updated) {
        await repository.appendEvent({ runId: run.id, type: 'run.completed', payload: { score: output.matchReport.totalScore } });
        console.log(`Completed Career Run ${run.id}`);
      }
    } catch (error) {
      const retry = run.attemptCount < maxAttempts && error.retryable !== false;
      const updated = await repository.updateRun(run.id, {
        status: retry ? 'queued' : 'failed',
        error: error.message,
        leaseUntil: null,
        heartbeatAt: null,
        completedAt: retry ? null : new Date().toISOString()
      }, { expectedStatus: 'running' });
      if (updated) {
        await repository.appendEvent({
          runId: run.id,
          type: retry ? 'run.retried' : 'run.failed',
          payload: { message: error.message, attemptCount: run.attemptCount, retryable: retry }
        });
        console.error(`Career Run ${run.id} ${retry ? 'scheduled for retry' : 'failed'}`, error.message);
      }
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    console.error('Worker poll failed', error.message);
  } finally {
    polling = false;
  }
}

console.log(`AI Career Copilot Worker started (${repository.mode}, model=${modelGateway.provider})`);
if (repository.mode === 'memory') {
  console.warn('Worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to share a queue with the API.');
}
setInterval(processNext, pollMs);
processNext();
