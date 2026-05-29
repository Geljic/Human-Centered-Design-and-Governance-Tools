window.Synth = window.Synth || {};

Synth.api = (function () {
  const RETRY_DELAYS = [1000, 3000, 9000];
  const LS_ENDPOINT = 'synth_api_endpoint';
  const LS_KEY = 'synth_api_key';

  function getEndpoint() {
    return (localStorage.getItem(LS_ENDPOINT) || '').replace(/\/+$/, '');
  }

  function getApiKey() {
    return localStorage.getItem(LS_KEY) || '';
  }

  function saveCredentials(endpoint, apiKey) {
    localStorage.setItem(LS_ENDPOINT, endpoint.replace(/\/+$/, ''));
    localStorage.setItem(LS_KEY, apiKey);
  }

  function hasCredentials() {
    return !!(getEndpoint() && getApiKey());
  }

  function headers() {
    return {
      'Authorization': 'Bearer ' + getApiKey(),
      'Content-Type': 'application/json'
    };
  }

  async function fetchWithRetry(url, options, retries) {
    if (retries === undefined) retries = RETRY_DELAYS.length;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);
        const fetchOpts = Object.assign({}, options, { signal: controller.signal });
        const res = await fetch(url, fetchOpts).finally(() => clearTimeout(timeoutId));

        if (res.ok) return res;

        if (res.status === 429 || res.status >= 500) {
          lastError = new Error('HTTP ' + res.status + ': ' + res.statusText);
          if (attempt < retries) {
            await sleep(RETRY_DELAYS[attempt] || 9000);
            continue;
          }
        }

        const body = await res.text().catch(() => '');
        const err = new Error(friendlyError(res.status, body));
        err.status = res.status;
        err.body = body;
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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function chatCompletion(model, messages, options) {
    const endpoint = getEndpoint();
    if (!endpoint) throw new Error('API endpoint not configured. Go to the Setup tab.');

    const MODEL_MAX_OUTPUT = {
      'claude-sonnet-4-6': 64000,
      'claude-sonnet-4-5': 64000,
      'claude-haiku-4-5': 64000,
      'claude-opus-4-7': 128000,
      'claude-opus-4-6': 128000,
      'claude-opus-4-5': 64000
    };
    const noTempModels = ['claude-opus-4-7'];

    var modelPrefix = Object.keys(MODEL_MAX_OUTPUT).find(function (k) { return model.startsWith(k); });
    var modelCap = modelPrefix ? MODEL_MAX_OUTPUT[modelPrefix] : 16000;
    var requestedMax = options?.max_tokens ?? 4096;

    const body = {
      model: model,
      messages: messages,
      max_tokens: Math.min(requestedMax, modelCap)
    };
    if (!noTempModels.some(m => model.startsWith(m))) {
      body.temperature = options?.temperature ?? 0;
    }

    const res = await fetchWithRetry(endpoint + '/v1/chat/completions', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });

    const data = await res.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
      usage: data.usage || {},
      model: data.model || model,
      raw: data
    };
  }

  async function chatCompletionStream(model, messages, options, onChunk) {
    const endpoint = getEndpoint();
    if (!endpoint) throw new Error('API endpoint not configured. Go to the Setup tab.');

    const MODEL_MAX_OUTPUT = {
      'claude-sonnet-4-6': 64000,
      'claude-sonnet-4-5': 64000,
      'claude-haiku-4-5': 64000,
      'claude-opus-4-7': 128000,
      'claude-opus-4-6': 128000,
      'claude-opus-4-5': 64000
    };
    const noTempModels = ['claude-opus-4-7'];

    var modelPrefix = Object.keys(MODEL_MAX_OUTPUT).find(function (k) { return model.startsWith(k); });
    var modelCap = modelPrefix ? MODEL_MAX_OUTPUT[modelPrefix] : 16000;
    var requestedMax = options?.max_tokens ?? 4096;

    const body = {
      model: model,
      messages: messages,
      max_tokens: Math.min(requestedMax, modelCap),
      stream: true
    };
    if (!noTempModels.some(m => model.startsWith(m))) {
      body.temperature = options?.temperature ?? 0;
    }

    const res = await fetch(endpoint + '/v1/chat/completions', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(friendlyError(res.status, errBody));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    var content = '';
    var finishReason = 'unknown';
    var responseModel = model;
    var usage = {};
    var buffer = '';
    var chunks = 0;

    while (true) {
      var readResult = await reader.read();
      if (readResult.done) break;

      buffer += decoder.decode(readResult.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop();

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || !line.startsWith('data: ')) continue;
        var data = line.substring(6);
        if (data === '[DONE]') continue;

        try {
          var parsed = JSON.parse(data);
          var delta = parsed.choices?.[0]?.delta;
          if (delta && delta.content) {
            content += delta.content;
            chunks++;
          }
          if (parsed.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }
          if (parsed.model) responseModel = parsed.model;
          if (parsed.usage) usage = parsed.usage;

          if (onChunk) onChunk(content.length, chunks, content);
        } catch (e) {
          // skip unparseable chunks
        }
      }
    }

    return {
      content: content,
      finish_reason: finishReason,
      usage: usage,
      model: responseModel
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

    const data = await res.json();
    const models = (data.data || []).map((m) => m.id).sort();

    return {
      success: true,
      models: models,
      anthropic: models.filter((m) => /claude|sonnet|haiku|opus/i.test(m))
    };
  }

  return {
    getEndpoint, getApiKey, saveCredentials, hasCredentials,
    chatCompletion, chatCompletionStream, testConnection
  };
})();
