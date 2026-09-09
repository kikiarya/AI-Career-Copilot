import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelGateway, PROVIDER_PRESETS } from '../src/index.js';

const schema = {
  safeParse(value) {
    return value && typeof value.answer === 'string'
      ? { success: true, data: value }
      : { success: false, error: { issues: [{ message: 'answer is required' }] } };
  },
  parse(value) {
    return value;
  }
};

test('all V1 provider presets use an OpenAI-compatible base URL', () => {
  for (const provider of ['openai', 'deepseek', 'qwen', 'openrouter', 'ollama', 'vllm']) {
    const gateway = createModelGateway({ MODEL_PROVIDER: provider, MODEL_NAME: 'test-model', MODEL_API_KEY: 'test-key' });
    assert.equal(gateway.provider, provider);
    assert.equal(gateway.describe().baseUrl, PROVIDER_PRESETS[provider].baseUrl);
  }
});

test('OpenAI-compatible gateway parses structured output and records usage', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer test-key');
    return new Response(JSON.stringify({
      model: 'test-model',
      choices: [{ message: { content: JSON.stringify({ answer: 'ok' }) } }],
      usage: { prompt_tokens: 5, completion_tokens: 2 }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const gateway = createModelGateway({
      MODEL_PROVIDER: 'openai-compatible',
      MODEL_BASE_URL: 'https://model.test/v1',
      MODEL_API_KEY: 'test-key',
      MODEL_NAME: 'test-model',
      MODEL_MAX_RETRIES: '0'
    });
    const result = await gateway.generateStructured({
      task: 'test_task',
      systemPrompt: 'Return JSON.',
      userPrompt: 'Answer ok.',
      schema,
      jsonSchema: { type: 'object' }
    });
    assert.equal(result.value.answer, 'ok');
    assert.equal(result.schemaValidated, true);
    assert.deepEqual(result.usage, { prompt_tokens: 5, completion_tokens: 2 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retryable provider errors are retried, while the final error is sanitized', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: 'temporary upstream failure' } }), { status: 503 });
  };
  try {
    const gateway = createModelGateway({
      MODEL_PROVIDER: 'openai-compatible',
      MODEL_BASE_URL: 'https://model.test/v1',
      MODEL_API_KEY: 'test-key',
      MODEL_NAME: 'test-model',
      MODEL_MAX_RETRIES: '1',
      MODEL_TIMEOUT_MS: '1000'
    });
    await assert.rejects(() => gateway.generateText({ systemPrompt: 'system', userPrompt: 'user' }), /temporary upstream failure/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unsupported response_format falls back to prompt-constrained JSON', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    const request = JSON.parse(options.body);
    if (request.response_format) {
      return new Response(JSON.stringify({ error: { message: 'response_format is not supported' } }), { status: 400 });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: 'fallback-ok' }) } }] }), { status: 200 });
  };
  try {
    const gateway = createModelGateway({
      MODEL_PROVIDER: 'ollama',
      MODEL_NAME: 'llama-test',
      MODEL_MAX_RETRIES: '0'
    });
    const result = await gateway.generateStructured({
      task: 'fallback_task',
      systemPrompt: 'Return JSON.',
      userPrompt: 'Answer.',
      schema,
      maxSchemaRepairs: 0
    });
    assert.equal(result.value.answer, 'fallback-ok');
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
