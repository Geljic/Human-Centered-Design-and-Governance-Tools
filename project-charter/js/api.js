// ============================================================
// API — LiteLLM / OpenAI-compatible client
// Adapted from Persona Builder
// ============================================================

const LS_ENDPOINT = 'charter_api_endpoint';
const LS_KEY      = 'charter_api_key';
const LS_MODEL    = 'charter_api_model';

const DEFAULT_ENDPOINT = '';
const DEFAULT_MODEL    = 'claude-sonnet-4-6';

const RETRY_DELAYS = [1000, 3000, 9000];

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
  if (endpoint !== undefined) localStorage.setItem(LS_ENDPOINT, (endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, ''));
  if (apiKey  !== undefined) localStorage.setItem(LS_KEY, apiKey);
  if (model   !== undefined && model) localStorage.setItem(LS_MODEL, model);
}

function hasCredentials() {
  return !!(getEndpoint() && getApiKey());
}

function apiHeaders() {
  return {
    'Authorization': 'Bearer ' + getApiKey(),
    'Content-Type':  'application/json'
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

async function fetchWithRetry(url, options, retries) {
  if (retries === undefined) retries = RETRY_DELAYS.length;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      if (res.ok) return res;

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error('HTTP ' + res.status + ': ' + res.statusText);
        if (attempt < retries) {
          await sleep(RETRY_DELAYS[attempt] || 9000);
          continue;
        }
      }

      const body = await res.text().catch(() => '');
      const err  = new Error(friendlyError(res.status, body));
      err.status = res.status;
      err.body   = body;
      throw err;
    } catch (e) {
      if (e.status) throw e;
      lastError = e;
      if (attempt < retries) {
        await sleep(RETRY_DELAYS[attempt] || 9000);
        continue;
      }
    }
  }
  throw lastError;
}

async function chatCompletion(messages, options) {
  const endpoint = getEndpoint();
  if (!endpoint) throw new Error('API endpoint not configured. Open AI Setup to configure.');

  const body = {
    model:       options?.model || getModel(),
    messages:    messages,
    temperature: options?.temperature ?? 0,
    max_tokens:  options?.max_tokens ?? 4096
  };

  const res = await fetchWithRetry(endpoint + '/v1/chat/completions', {
    method:  'POST',
    headers: apiHeaders(),
    body:    JSON.stringify(body)
  });

  const data = await res.json();

  return {
    content:       data.choices?.[0]?.message?.content || '',
    finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
    usage:         data.usage || {},
    model:         data.model || body.model,
    raw:           data
  };
}

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
