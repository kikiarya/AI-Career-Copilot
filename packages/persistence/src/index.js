import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const memoryRuns = new Map();
const memoryEvents = new Map();

const now = () => new Date().toISOString();

function toRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    input: row.input,
    output: row.output ?? null,
    error: row.error ?? null,
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

export function createCareerRepository(env = process.env) {
  const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  const client = hasSupabase
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

  return {
    mode: hasSupabase ? 'supabase' : 'memory',

    async createRun({ userId, input, idempotencyKey }) {
      if (!client) {
        const existing = [...memoryRuns.values()].find(
          (run) => run.userId === userId && run.idempotencyKey === idempotencyKey
        );
        if (existing) return toRun(existing);
        const timestamp = now();
        const row = {
          id: randomUUID(),
          user_id: userId,
          status: 'queued',
          input,
          output: null,
          error: null,
          idempotencyKey,
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
        .insert({ user_id: userId, input, idempotency_key: idempotencyKey ?? null })
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

    async getRun(id) {
      if (!client) return toRun(memoryRuns.get(id));
      const { data, error } = await client.from('career_runs').select('*').eq('id', id).maybeSingle();
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

      const { data: latest, error: latestError } = await client
        .from('career_run_events')
        .select('sequence')
        .eq('run_id', runId)
        .order('sequence', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;
      const { data, error } = await client
        .from('career_run_events')
        .insert({
          run_id: runId,
          sequence: (latest?.sequence ?? -1) + 1,
          type,
          step,
          payload
        })
        .select('*')
        .single();
      if (error) throw error;
      return toEvent(data);
    },

    async updateRun(id, patch) {
      if (!client) {
        const row = memoryRuns.get(id);
        if (!row) return null;
        Object.assign(row, patch, { updated_at: now() });
        memoryRuns.set(id, row);
        return toRun(row);
      }
      const { data, error } = await client
        .from('career_runs')
        .update({ ...patch, updated_at: now() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return toRun(data);
    },

    async claimNextRun() {
      if (!client) return null;
      const { data, error } = await client.rpc('claim_next_career_run');
      if (error) throw error;
      return toRun(data?.[0] ?? null);
    }
  };
}
