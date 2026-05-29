// ============================================================
// Status Report — api.js
// LiteLLM / OpenAI-compatible client (mirrors Persona Builder)
// ============================================================

const SR_LS_ENDPOINT = 'sr_api_endpoint';
const SR_LS_KEY      = 'sr_api_key';
const SR_LS_MODEL    = 'sr_api_model';

const SR_DEFAULT_ENDPOINT = '';
const SR_DEFAULT_MODEL    = 'claude-sonnet-4-6';

const SR_RETRY_DELAYS = [1000, 3000, 9000];

function srGetEndpoint() {
  return (localStorage.getItem(SR_LS_ENDPOINT) || SR_DEFAULT_ENDPOINT).replace(/\/+$/, '');
}

function srGetApiKey() {
  return localStorage.getItem(SR_LS_KEY) || '';
}

function srGetModel() {
  return localStorage.getItem(SR_LS_MODEL) || SR_DEFAULT_MODEL;
}

function srSaveApiCredentials(endpoint, apiKey, model) {
  localStorage.setItem(SR_LS_ENDPOINT, (endpoint || '').replace(/\/+$/, ''));
  localStorage.setItem(SR_LS_KEY, apiKey || '');
  if (model) localStorage.setItem(SR_LS_MODEL, model);
}

function srHasCredentials() {
  return !!(srGetEndpoint() && srGetApiKey());
}

function srApiHeaders() {
  return {
    'Authorization': 'Bearer ' + srGetApiKey(),
    'Content-Type': 'application/json',
  };
}

function srSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function srFriendlyError(status, body) {
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

async function srFetchWithRetry(url, options, retries) {
  if (retries === undefined) retries = SR_RETRY_DELAYS.length;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error('HTTP ' + res.status + ': ' + res.statusText);
        if (attempt < retries) {
          await srSleep(SR_RETRY_DELAYS[attempt] || 9000);
          continue;
        }
        const body = await res.text().catch(() => '');
        throw new Error(srFriendlyError(res.status, body));
      }

      const body = await res.text().catch(() => '');
      throw new Error(srFriendlyError(res.status, body));
    } catch (err) {
      if (err.name === 'TypeError') {
        lastError = new Error('Network error — check your connection or API URL.');
        if (attempt < retries) {
          await srSleep(SR_RETRY_DELAYS[attempt] || 9000);
          continue;
        }
      }
      throw lastError || err;
    }
  }
  throw lastError || new Error('Request failed after retries.');
}

async function srChatCompletion(messages) {
  const url = srGetEndpoint() + '/v1/chat/completions';
  const body = JSON.stringify({
    model: srGetModel(),
    messages,
    temperature: 0.3,
    max_tokens: 4096,
  });

  const res = await srFetchWithRetry(url, {
    method: 'POST',
    headers: srApiHeaders(),
    body,
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return { content };
}

async function srTestConnection() {
  const url = srGetEndpoint() + '/v1/models';
  const res = await srFetchWithRetry(url, {
    method: 'GET',
    headers: srApiHeaders(),
  });
  const data = await res.json();
  const models = (data.data || []).map((m) => m.id).sort();
  return { models };
}
