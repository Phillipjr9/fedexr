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
    throw new AccountApiError(
      503,
      'The account API is unavailable. Configure and start the account service; browser-local access is not used as a fallback.',
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
