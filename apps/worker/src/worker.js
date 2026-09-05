import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createCareerRepository } from '@copilot/persistence';
import { runCareerWorkflow } from './workflow.js';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env')
});

const repository = createCareerRepository();
const pollMs = Number(process.env.WORKER_POLL_MS ?? 1500);
let polling = false;

async function processNext() {
  if (polling || repository.mode !== 'supabase') return;
  polling = true;
  try {
    const run = await repository.claimNextRun();
    if (!run) return;
    try {
      const output = await runCareerWorkflow({ run, repository });
      await repository.updateRun(run.id, {
        status: 'completed',
        output,
        completed_at: new Date().toISOString()
      });
      await repository.appendEvent({ runId: run.id, type: 'run.completed', payload: { score: output.matchReport.totalScore } });
      console.log(`Completed Career Run ${run.id}`);
    } catch (error) {
      await repository.updateRun(run.id, { status: 'failed', error: error.message });
      await repository.appendEvent({ runId: run.id, type: 'run.failed', payload: { message: error.message } });
      console.error(`Career Run ${run.id} failed`, error);
    }
  } catch (error) {
    console.error('Worker poll failed', error.message);
  } finally {
    polling = false;
  }
}

console.log(`AI Career Copilot Worker started (${repository.mode})`);
if (repository.mode === 'memory') {
  console.warn('Worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to share a queue with the API.');
}
setInterval(processNext, pollMs);
processNext();
