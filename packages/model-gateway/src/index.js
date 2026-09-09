const PROVIDER_PRESETS = {
  openai: { baseUrl: 'https://api.openai.com/v1' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1' },
  ollama: { baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama' },
  vllm: { baseUrl: 'http://localhost:8000/v1', apiKey: 'EMPTY' }
};

export class ModelGatewayError extends Error {
  constructor(message, { statusCode, retryable = true, code = 'model_gateway_error', details } = {}) {
    super(message);
    this.name = 'ModelGatewayError';
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.code = code;
    this.details = details;
  }
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function parseJson(text) {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new ModelGatewayError('Model returned invalid JSON.', {
      retryable: true,
      code: 'invalid_json',
      details: { parserMessage: error.message, preview: trimmed.slice(0, 240) }
    });
  }
}

function extractText(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  throw new ModelGatewayError('Model response did not contain message content.', {
    retryable: false,
    code: 'empty_model_content'
  });
}

function waitMs(attempt) {
  return Math.min(4000, 250 * (2 ** attempt)) + Math.floor(Math.random() * 100);
}

function isRetryableStatus(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function headersFor(provider, apiKey, env) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json'
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (provider === 'openrouter') {
    if (env.OPENROUTER_HTTP_REFERER) headers['HTTP-Referer'] = env.OPENROUTER_HTTP_REFERER;
    if (env.OPENROUTER_TITLE) headers['X-Title'] = env.OPENROUTER_TITLE;
  }
  return headers;
}

function createMockGateway() {
  return {
    mode: 'mock',
    provider: 'mock',
    model: 'mock-career-model',
    describe() {
      return { provider: 'mock', model: 'mock-career-model' };
    },
    async generateText({ fallbackValue = '' }) {
      return { value: fallbackValue, provider: 'mock', model: 'mock-career-model', latencyMs: 0, usage: null };
    },
    async generateStructured({ schema, fallbackValue }) {
      if (fallbackValue === undefined) {
        throw new ModelGatewayError('Mock Provider requires a deterministic fallback value.', { retryable: false, code: 'mock_value_missing' });
      }
      return {
        value: schema.parse(fallbackValue),
        provider: 'mock',
        model: 'mock-career-model',
        latencyMs: 0,
        usage: null,
        schemaValidated: true
      };
    }
  };
}

function createOpenAICompatibleGateway(env) {
  const provider = env.MODEL_PROVIDER;
  const preset = PROVIDER_PRESETS[provider] ?? {};
  const baseUrl = env.MODEL_BASE_URL ?? preset.baseUrl;
  const apiKey = env.MODEL_API_KEY ?? preset.apiKey;
  const model = env.MODEL_NAME;
  const timeoutMs = Number(env.MODEL_TIMEOUT_MS ?? 30000);
  const maxRetries = Number(env.MODEL_MAX_RETRIES ?? 2);
  const temperature = Number(env.MODEL_TEMPERATURE ?? 0.2);
  const maxTokens = Number(env.MODEL_MAX_TOKENS ?? 4096);
  const chatPath = env.MODEL_CHAT_PATH ?? '/chat/completions';

  if (!baseUrl) throw new Error(`MODEL_BASE_URL is required for provider ${provider}.`);
  if (!model) throw new Error('MODEL_NAME is required for a real model provider.');
  if (!apiKey && !['ollama', 'vllm'].includes(provider)) throw new Error('MODEL_API_KEY is required for a real model provider.');

  async function complete({ messages, responseFormat }) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const startedAt = Date.now();
      try {
        const response = await fetch(joinUrl(baseUrl, chatPath), {
          method: 'POST',
          headers: headersFor(provider, apiKey, env),
          body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, ...(responseFormat ? { response_format: responseFormat } : {}) }),
          signal: controller.signal
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new ModelGatewayError(body?.error?.message ?? `Model request failed with HTTP ${response.status}.`, {
            statusCode: response.status,
            retryable: isRetryableStatus(response.status),
            code: 'provider_http_error',
            details: { provider, attempt }
          });
        }
        return {
          text: extractText(body),
          provider,
          model: body.model ?? model,
          latencyMs: Date.now() - startedAt,
          usage: body.usage ?? null,
          schemaValidated: false
        };
      } catch (error) {
        lastError = error.name === 'AbortError'
          ? new ModelGatewayError(`Model request timed out after ${timeoutMs}ms.`, { code: 'model_timeout', retryable: true })
          : error;
        if (!(lastError instanceof ModelGatewayError) || !lastError.retryable || attempt >= maxRetries) throw lastError;
        await new Promise((resolve) => setTimeout(resolve, waitMs(attempt)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  async function generateText({ systemPrompt, userPrompt }) {
    return complete({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }).then((result) => ({ ...result, value: result.text }));
  }

  async function generateStructured({ task, systemPrompt, userPrompt, schema, jsonSchema, maxSchemaRepairs = 1 }) {
    let repairPrompt = userPrompt;
    let lastError;
    for (let attempt = 0; attempt <= maxSchemaRepairs; attempt += 1) {
      const messages = [
        { role: 'system', content: `${systemPrompt}\nReturn JSON only. Task: ${task}.` },
        { role: 'user', content: repairPrompt }
      ];
      const responseFormat = jsonSchema ? {
        type: 'json_schema',
        json_schema: { name: task.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64), strict: true, schema: jsonSchema }
      } : { type: 'json_object' };
      let result;
      try {
        result = await complete({ messages, responseFormat });
      } catch (error) {
        // Some OpenAI-compatible servers support JSON output but reject the
        // response_format field. Keep the prompt constraint and validate locally.
        if (error.statusCode !== 400) throw error;
        result = await complete({ messages });
      }
      try {
        const parsed = schema.safeParse(parseJson(result.text));
        if (parsed.success) return { ...result, value: parsed.data, schemaValidated: true };
        lastError = new ModelGatewayError('Model output failed schema validation.', {
          code: 'schema_validation_error',
          retryable: attempt < maxSchemaRepairs,
          details: { issues: parsed.error.issues }
        });
      } catch (error) {
        lastError = error;
      }
      repairPrompt = `${userPrompt}\n\nPrevious output failed validation. Return corrected JSON only. Validation error: ${JSON.stringify(lastError.details ?? lastError.message)}`;
    }
    throw lastError;
  }

  return {
    mode: 'live',
    provider,
    model,
    describe: () => ({ provider, model, baseUrl }),
    generateText,
    generateStructured
  };
}

export function createModelGateway(env = process.env) {
  if ((env.MODEL_PROVIDER ?? 'mock') === 'mock') return createMockGateway();
  if (!Object.hasOwn(PROVIDER_PRESETS, env.MODEL_PROVIDER) && env.MODEL_PROVIDER !== 'openai-compatible') {
    throw new Error(`Unsupported MODEL_PROVIDER: ${env.MODEL_PROVIDER}`);
  }
  return createOpenAICompatibleGateway(env);
}

export { PROVIDER_PRESETS };
