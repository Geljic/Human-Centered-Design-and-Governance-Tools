// ============================================================
// API — LiteLLM / OpenAI-compatible client
// Adapted from Persona Builder for Ideation Scanner
// ============================================================

const LS_ENDPOINT = 'ideation_api_endpoint';
const LS_KEY      = 'ideation_api_key';
const LS_MODEL    = 'ideation_api_model';

const DEFAULT_ENDPOINT = '';
const DEFAULT_MODEL    = 'claude-sonnet-4-6';

const RETRY_DELAYS = [2000, 5000, 12000];
const DEFAULT_TIMEOUT_MS = 480000; // 8 minutes default

function getEndpoint() {
  return (localStorage.getItem(LS_ENDPOINT) || DEFAULT_ENDPOINT).replace(/\/+$/, '');
}

function getApiKey() {
  return localStorage.getItem(LS_KEY) || '';
}

function getModel() {
  return localStorage.getItem(LS_MODEL) || DEFAULT_MODEL;
}

function saveApiCredentials(endpoint, apiKey, model) {
  localStorage.setItem(LS_ENDPOINT, endpoint.replace(/\/+$/, ''));
  localStorage.setItem(LS_KEY, apiKey);
  if (model) localStorage.setItem(LS_MODEL, model);
}

function hasCredentials() {
  return !!(getEndpoint() && getApiKey());
}

function apiHeaders() {
  return {
    'Authorization': 'Bearer ' + getApiKey(),
    'Content-Type': 'application/json'
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyError(status, body) {
  switch (status) {
    case 401: return 'Authentication failed — check your API key.';
    case 403: return 'Access denied — your API key may not have permission for this model.';
    case 404: return 'Endpoint not found — check your API URL.';
    case 413: return 'Request too large — try reducing the input size or number of opportunities.';
    case 429: return 'Rate limited — too many requests. Try again in a moment.';
    default:
      if (status >= 500) return 'Gateway error (HTTP ' + status + '). The service may be temporarily unavailable.';
      try {
        const parsed = JSON.parse(body);
        return parsed.error?.message || 'API error (HTTP ' + status + '): ' + body.substring(0, 200);
      } catch (_) {
        return 'API error (HTTP ' + status + '): ' + body.substring(0, 200);
      }
  }
}

/**
 * Fetch with retry logic. Does NOT retry on timeout (AbortError) — only on
 * transient server errors (429, 5xx) and network glitches.
 *
 * @param {string} url
 * @param {Object} options - fetch options
 * @param {number} retries - max retry count
 * @param {number} timeoutMs - per-request timeout in milliseconds
 */
async function fetchWithRetry(url, options, retries, timeoutMs) {
  if (retries === undefined) retries = RETRY_DELAYS.length;
  if (timeoutMs === undefined) timeoutMs = DEFAULT_TIMEOUT_MS;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const fetchOpts = Object.assign({}, options, { signal: controller.signal });
      const res = await fetch(url, fetchOpts).finally(() => clearTimeout(timeoutId));

      if (res.ok) return res;

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error('HTTP ' + res.status + ': ' + res.statusText);
        if (attempt < retries) {
          await sleep(RETRY_DELAYS[attempt] || 12000);
          continue;
        }
      }

      const body = await res.text().catch(() => '');
      const err  = new Error(friendlyError(res.status, body));
      err.status = res.status;
      err.body   = body;
      throw err;
    } catch (e) {
      // Don't retry on timeout — it will just timeout again
      if (e.name === 'AbortError') {
        const timeoutSecs = Math.round(timeoutMs / 1000);
        throw new Error(
          'Request timed out after ' + timeoutSecs + ' seconds. ' +
          'The AI is taking too long to respond. This usually means the request is too complex. ' +
          'Try reducing the number of opportunities or simplifying the project context.'
        );
      }
      if (e.status) throw e;
      lastError = e;
      if (attempt < retries) {
        await sleep(RETRY_DELAYS[attempt] || 12000);
        continue;
      }
    }
  }
  throw lastError;
}

/**
 * Estimate the token count for a string (rough: ~4 chars per token for English).
 */
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/**
 * Send a chat completion request to the LiteLLM proxy.
 * @param {Array} messages - Array of {role, content} message objects
 * @param {Object} options - Optional overrides: model, temperature, max_tokens, timeoutMs
 * @returns {Object} { content, finish_reason, usage, model, raw }
 */
async function chatCompletion(messages, options) {
  const endpoint = getEndpoint();
  if (!endpoint) throw new Error('API endpoint not configured. Open Settings to configure.');

  const body = {
    model:       options?.model || getModel(),
    messages:    messages,
    temperature: options?.temperature ?? 0,
    max_tokens:  options?.max_tokens ?? 8000
  };

  // Estimate input size for logging
  const inputChars = messages.reduce((sum, m) => sum + (m.content || '').length, 0);
  const estTokens = estimateTokens(messages.map(m => m.content).join(''));
  console.log('[API] Request: model=' + body.model + ', est_input_tokens=' + estTokens +
    ', max_output_tokens=' + body.max_tokens + ', input_chars=' + inputChars);

  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

  const res = await fetchWithRetry(endpoint + '/v1/chat/completions', {
    method:  'POST',
    headers: apiHeaders(),
    body:    JSON.stringify(body)
  }, RETRY_DELAYS.length, timeoutMs);

  const data = await res.json();

  const result = {
    content:       data.choices?.[0]?.message?.content || '',
    finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
    usage:         data.usage || {},
    model:         data.model || body.model,
    raw:           data
  };

  console.log('[API] Response: finish_reason=' + result.finish_reason +
    ', output_chars=' + result.content.length +
    ', tokens=' + JSON.stringify(result.usage));

  return result;
}

/**
 * Test the connection to the LiteLLM proxy.
 * @returns {Object} { success, models, anthropic }
 */
async function testConnection() {
  const endpoint = getEndpoint();
  if (!endpoint) throw new Error('No API endpoint configured.');
  if (!getApiKey()) throw new Error('No API key configured.');

  let res;
  try {
    res = await fetch(endpoint + '/v1/models', {
      headers: { 'Authorization': 'Bearer ' + getApiKey() }
    });
  } catch (e) {
    throw new Error(
      'Could not reach the gateway. Check that the endpoint URL is correct ' +
      'and the gateway allows requests from this origin (' +
      (window.location.origin || 'file://') + ').'
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(friendlyError(res.status, body));
  }

  const data   = await res.json();
  const models = (data.data || []).map((m) => m.id).sort();

  return {
    success:   true,
    models:    models,
    anthropic: models.filter((m) => /claude|sonnet|haiku|opus/i.test(m))
  };
}
