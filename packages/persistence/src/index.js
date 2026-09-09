import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const memoryRuns = new Map();
const memoryEvents = new Map();
const memoryEvidence = new Map();

const now = () => new Date().toISOString();

function toEvidence(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    content: row.content,
    skills: row.skills ?? [],
    sourceType: row.source_type,
    sourceUrl: row.source_url ?? null,
    verificationStatus: row.verification_status,
    proofLinks: row.proof_links ?? [],
    metrics: row.metrics ?? [],
    contentHash: row.content_hash ?? null,
    sourceMetadata: row.source_metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    input: row.input,
    output: row.output ?? null,
    error: row.error ?? null,
    evidenceSnapshot: row.evidence_snapshot ?? row.input?.evidence ?? [],
    attemptCount: row.attempt_count ?? 0,
    leaseUntil: row.lease_until ?? null,
    heartbeatAt: row.heartbeat_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toEvent(row) {
  return {
    runId: row.run_id,
    sequence: row.sequence,
    type: row.type,
    step: row.step ?? null,
    payload: row.payload ?? {},
    createdAt: row.created_at
  };
}

function evidenceInsert(input) {
  return {
    type: input.type,
    title: input.title,
    content: input.content,
    skills: input.skills ?? [],
    source_type: input.sourceType ?? 'manual',
    source_url: input.sourceUrl ?? null,
    verification_status: 'draft',
    proof_links: input.proofLinks ?? [],
    metrics: input.metrics ?? [],
    content_hash: input.contentHash ?? null,
    source_metadata: input.sourceMetadata ?? {}
  };
}

function evidencePatch(patch) {
  const mapping = {
    type: 'type',
    title: 'title',
    content: 'content',
    skills: 'skills',
    sourceType: 'source_type',
    sourceUrl: 'source_url',
    verificationStatus: 'verification_status',
    proofLinks: 'proof_links',
    metrics: 'metrics'
  };
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([key, value]) => mapping[key] && value !== undefined)
      .map(([key, value]) => [mapping[key], value])
  );
}

function runPatch(patch) {
  const mapping = {
    status: 'status',
    output: 'output',
    error: 'error',
    completedAt: 'completed_at',
    completed_at: 'completed_at',
    startedAt: 'started_at',
    started_at: 'started_at',
    leaseUntil: 'lease_until',
    lease_until: 'lease_until',
    heartbeatAt: 'heartbeat_at',
    heartbeat_at: 'heartbeat_at',
    attemptCount: 'attempt_count',
    attempt_count: 'attempt_count'
  };
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([key]) => mapping[key])
      .map(([key, value]) => [mapping[key], value])
  );
}

export function createCareerRepository(env = process.env) {
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const client = hasSupabase
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

  return {
    mode: hasSupabase ? 'supabase' : 'memory',

    async createEvidence({ userId, input }) {
      if (!client) {
        const timestamp = now();
        const row = {
          id: randomUUID(),
          user_id: userId,
          ...evidenceInsert(input),
          created_at: timestamp,
          updated_at: timestamp
        };
        memoryEvidence.set(row.id, row);
        return toEvidence(row);
      }

      const { data, error } = await client
        .from('candidate_evidence')
        .insert({ user_id: userId, ...evidenceInsert(input) })
        .select('*')
        .single();
      if (error) throw error;
      return toEvidence(data);
    },

    async listEvidence(userId) {
      if (!client) {
        return [...memoryEvidence.values()]
          .filter((row) => row.user_id === userId)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map(toEvidence);
      }
      const { data, error } = await client
        .from('candidate_evidence')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data.map(toEvidence);
    },

    async getEvidenceByIds(userId, ids) {
      if (!ids?.length) return [];
      const found = client
        ? await client.from('candidate_evidence').select('*').eq('user_id', userId).in('id', ids)
        : { data: [...memoryEvidence.values()].filter((row) => row.user_id === userId && ids.includes(row.id)), error: null };
      if (found.error) throw found.error;
      const byId = new Map(found.data.map((row) => [row.id, toEvidence(row)]));
      return ids.map((id) => byId.get(id)).filter(Boolean);
    },

    async updateEvidence(id, userId, patch) {
      if (!client) {
        const row = memoryEvidence.get(id);
        if (!row || row.user_id !== userId) return null;
        Object.assign(row, evidencePatch(patch), { updated_at: now() });
        memoryEvidence.set(id, row);
        return toEvidence(row);
      }
      const { data, error } = await client
        .from('candidate_evidence')
        .update({ ...evidencePatch(patch), updated_at: now() })
        .eq('id', id)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return toEvidence(data);
    },

    async deleteEvidence(id, userId) {
      if (!client) {
        const row = memoryEvidence.get(id);
        if (!row || row.user_id !== userId) return false;
        memoryEvidence.delete(id);
        return true;
      }
      const { data, error } = await client
        .from('candidate_evidence')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async createRun({ userId, input, evidenceSnapshot, idempotencyKey }) {
      const snapshot = evidenceSnapshot ?? input.evidence ?? [];
      if (!client) {
        const existing = idempotencyKey
          ? [...memoryRuns.values()].find(
              (run) => run.user_id === userId && run.idempotency_key === idempotencyKey
            )
          : null;
        if (existing) return toRun(existing);
        const timestamp = now();
        const row = {
          id: randomUUID(),
          user_id: userId,
          status: 'queued',
          input,
          evidence_snapshot: snapshot,
          output: null,
          error: null,
          idempotency_key: idempotencyKey,
          attempt_count: 0,
          lease_until: null,
          heartbeat_at: null,
          created_at: timestamp,
          updated_at: timestamp
        };
        memoryRuns.set(row.id, row);
        memoryEvents.set(row.id, []);
        await this.appendEvent({ runId: row.id, type: 'run.created', payload: { mode: 'memory' } });
        return toRun(row);
      }

      const { data, error } = await client
        .from('career_runs')
        .insert({ user_id: userId, input, evidence_snapshot: snapshot, idempotency_key: idempotencyKey ?? null })
        .select('*')
        .single();
      if (error) {
        if (error.code === '23505' && idempotencyKey) {
          const existing = await client
            .from('career_runs')
            .select('*')
            .eq('user_id', userId)
            .eq('idempotency_key', idempotencyKey)
            .single();
          if (existing.error) throw existing.error;
          return toRun(existing.data);
        }
        throw error;
      }
      await this.appendEvent({ runId: data.id, type: 'run.created', payload: { mode: 'supabase' } });
      return toRun(data);
    },

    async getRun(id, userId) {
      if (!client) {
        const row = memoryRuns.get(id);
        return row && (!userId || row.user_id === userId) ? toRun(row) : null;
      }
      let query = client.from('career_runs').select('*').eq('id', id);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return toRun(data);
    },

    async listEvents(runId) {
      if (!client) return (memoryEvents.get(runId) ?? []).map(toEvent);
      const { data, error } = await client
        .from('career_run_events')
        .select('*')
        .eq('run_id', runId)
        .order('sequence', { ascending: true });
      if (error) throw error;
      return data.map(toEvent);
    },

    async appendEvent({ runId, type, step = null, payload = {} }) {
      if (!client) {
        const events = memoryEvents.get(runId) ?? [];
        const event = {
          run_id: runId,
          sequence: events.length,
          type,
          step,
          payload,
          created_at: now()
        };
        events.push(event);
        memoryEvents.set(runId, events);
        return toEvent(event);
      }

      const { data, error } = await client.rpc('append_career_run_event', {
        p_run_id: runId,
        p_type: type,
        p_step: step,
        p_payload: payload
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Event append returned no row.');
      return toEvent(row);
    },

    async updateRun(id, patch, { expectedStatus } = {}) {
      const mapped = runPatch(patch);
      if (!client) {
        const row = memoryRuns.get(id);
        if (!row || (expectedStatus && row.status !== expectedStatus)) return null;
        Object.assign(row, mapped, { updated_at: now() });
        memoryRuns.set(id, row);
        return toRun(row);
      }
      let query = client.from('career_runs').update({ ...mapped, updated_at: now() }).eq('id', id);
      if (expectedStatus) query = query.eq('status', expectedStatus);
      const { data, error } = await query.select('*').maybeSingle();
      if (error) throw error;
      return toRun(data);
    },

    async claimNextRun(leaseSeconds = 300) {
      if (!client) return null;
      const { data, error } = await client.rpc('claim_next_career_run', { p_lease_seconds: leaseSeconds });
      if (error) throw error;
      return toRun(data?.[0] ?? null);
    },

    async requeueStaleRuns(maxAttempts = 3) {
      if (!client) return [];
      const { data, error } = await client.rpc('requeue_stale_career_runs', { p_max_attempts: maxAttempts });
      if (error) throw error;
      return (data ?? []).map(toRun);
    },

    async heartbeatRun(id, leaseSeconds = 300) {
      if (!client) {
        const row = memoryRuns.get(id);
        if (!row || row.status !== 'running') return false;
        row.lease_until = new Date(Date.now() + leaseSeconds * 1000).toISOString();
        row.heartbeat_at = now();
        row.updated_at = now();
        return true;
      }
      const { data, error } = await client.rpc('heartbeat_career_run', {
        p_run_id: id,
        p_lease_seconds: leaseSeconds
      });
      if (error) throw error;
      return data === true;
    },

    async cancelRun(id, userId) {
      const run = await this.getRun(id, userId);
      if (!run || !['queued', 'running', 'awaiting_review'].includes(run.status)) return null;
      const updated = await this.updateRun(id, {
        status: 'cancelled',
        leaseUntil: null,
        heartbeatAt: null
      }, { expectedStatus: run.status });
      if (!updated) return null;
      await this.appendEvent({ runId: id, type: 'run.cancelled', payload: { userId } });
      return updated;
    }
  };
}
