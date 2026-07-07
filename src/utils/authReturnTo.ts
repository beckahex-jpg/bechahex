const AUTH_RETURN_TO_KEY = 'bechahex_auth_return_to';

function isSafeReturnTo(path: string | null): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

export function saveAuthReturnTo(path: string) {
  if (typeof window === 'undefined' || !isSafeReturnTo(path)) return;
  window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, path);
}

export function takeAuthReturnTo() {
  if (typeof window === 'undefined') return null;

  const path = window.sessionStorage.getItem(AUTH_RETURN_TO_KEY);
  window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
  return isSafeReturnTo(path) ? path : null;
}

export function clearAuthReturnTo() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
}
