export async function extractGeminiErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text);
    const message = parsed.error?.message;
    const status = parsed.error?.status;

    if (message && status) {
      return `Gemini error (${status}): ${message}`;
    }

    if (message) {
      return `Gemini error: ${message}`;
    }
  } catch {
    // Fall through to the raw response body.
  }

  return `Gemini error (${response.status}): ${text || "Unknown error"}`;
}

export async function extractClaudeErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  const requestId = response.headers.get("request-id");

  try {
    const parsed = JSON.parse(text);
    const type = parsed.error?.type;
    const message = parsed.error?.message;

    if (message && type && requestId) {
      return `Claude error (${type}): ${message} [request id: ${requestId}]`;
    }

    if (message && type) {
      return `Claude error (${type}): ${message}`;
    }

    if (message && requestId) {
      return `Claude error: ${message} [request id: ${requestId}]`;
    }

    if (message) {
      return `Claude error: ${message}`;
    }
  } catch {
    // Fall through to the raw response body.
  }

  if (requestId) {
    return `Claude error (${response.status}): ${text || "Unknown error"} [request id: ${requestId}]`;
  }

  return `Claude error (${response.status}): ${text || "Unknown error"}`;
}
