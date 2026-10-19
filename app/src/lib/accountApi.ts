export class AccountApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function accountRequest<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new AccountApiError(
      503,
      'The account service could not be reached. Your change was not confirmed.',
    );
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    // Not JSON. Every account route answers JSON, including its own failures, so
    // a body that cannot be parsed means something outside the service replied:
    // an HTML 500 is a function that died while starting, an HTML 200 is a path
    // that matched no function and was served the application shell instead, and
    // an empty body is nothing answering at all. Those need different fixes, and
    // the status and content type are the only facts the person reading the
    // screen can carry back, so name them instead of guessing at a cause.
    const kind = response.headers.get('content-type')?.split(';')[0].trim();
    throw new AccountApiError(
      response.status || 503,
      `The account service is unavailable: it answered ${response.status || 'with no status'}${
        kind ? ` ${kind}` : ''
      } instead of JSON.`,
    );
  }
  if (!response.ok) {
    const error = result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
    const message =
      typeof error.error === 'string'
        ? error.error
        : typeof error.message === 'string'
          ? error.message
          : 'The account request could not be completed.';
    throw new AccountApiError(response.status, message);
  }
  return result as T;
}
