const authStorageKey = 'ff-mern-auth';
export const authExpiredEvent = 'ff-mern-auth-expired';

function isExpired(token) {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return false;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    return Number.isFinite(payload.exp) && payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export function readAuthState() {
  try {
    const stored = localStorage.getItem(authStorageKey);
    if (!stored) return { session: null, expiredRole: null };
    const session = JSON.parse(stored);
    const valid = session
      && typeof session.token === 'string'
      && session.user
      && typeof session.user.id === 'string'
      && typeof session.user.name === 'string'
      && typeof session.user.email === 'string'
      && ['customer', 'admin'].includes(session.user.role);
    if (!valid) {
      localStorage.removeItem(authStorageKey);
      return { session: null, expiredRole: null };
    }
    if (isExpired(session.token)) {
      localStorage.removeItem(authStorageKey);
      return { session: null, expiredRole: session.user.role };
    }
    return { session, expiredRole: null };
  } catch {
    return { session: null, expiredRole: null };
  }
}

export function saveAuthSession(session) {
  try {
    localStorage.setItem(authStorageKey, JSON.stringify(session));
  } catch {
    throw new Error('Could not save your sign-in in browser storage. Check your browser settings and try again.');
  }
}

export function clearAuthSession() {
  try {
    localStorage.removeItem(authStorageKey);
  } catch {
    throw new Error('Could not clear your sign-in from browser storage.');
  }
}

function notifyExpired(role) {
  try { localStorage.removeItem(authStorageKey); } catch { /* Continue by returning the user to sign-in. */ }
  window.dispatchEvent(new CustomEvent(authExpiredEvent, { detail: { role } }));
}

export async function api(url, options = {}) {
  const { body, requiresAuth = false, headers: suppliedHeaders, ...requestOptions } = options;
  const isAuthRequest = url.startsWith('/auth/');
  const authState = readAuthState();
  if (authState.expiredRole) {
    notifyExpired(authState.expiredRole);
    if (!isAuthRequest) throw new Error('Your session expired. Please sign in again.');
  }
  if (requiresAuth && !authState.session) {
    notifyExpired(typeof requiresAuth === 'string' ? requiresAuth : null);
    throw new Error('Please sign in to continue.');
  }

  const headers = new Headers(suppliedHeaders);
  headers.set('Content-Type', 'application/json');
  if (authState.session && !url.startsWith('/auth/')) {
    headers.set('Authorization', `Bearer ${authState.session.token}`);
  }

  let response;
  try {
    response = await fetch(`/api${url}`, {
      ...requestOptions,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the API. Check that the server and MongoDB are running.');
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && requiresAuth) {
    notifyExpired(authState.session?.user.role || null);
    throw new Error('Your session is invalid or expired. Please sign in again.');
  }
  if (!response.ok) throw new Error(data.message || 'Request failed. Check the API and database connection.');
  return data;
}
