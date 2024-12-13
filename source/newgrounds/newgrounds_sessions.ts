let NG_APP_ID: string | undefined = undefined;
let DEV_MODE: boolean | undefined = undefined;

type UserSessionCache = { [username: string]: string };
const session_id_cache: UserSessionCache = {};

export const set_session_id_cache = (c: UserSessionCache) => {
  for (const [username, session_id] of Object.entries(c)) {
    session_id_cache[username] = session_id;
  }
};

/// Checks if a incoming request balongs to an user, and if their session
/// matches the newgrounds session. returns an object containing the
/// username and session id, and a bool valid: true.
export const validate_request = async (request: Request) => {
  if (!NG_APP_ID) {
    DEV_MODE = Deno.env.get('DEV_MODE') === 'true';
    NG_APP_ID = Deno.env.get('NG_APP_ID');
  }

  const auth_header = request.headers.get('Authorization');

  const [protocol, auth_token] =
    request.headers.get('Sec-WebSocket-Protocol') ?? [];

  const auth =
    auth_header ?? (protocol === 'access_token' ? auth_token : undefined);

  if (!auth) {
    const url = new URL(request.url);

    const username = url.searchParams.get('username');
    const session_id = url.searchParams.get('session');
    if (!username || !session_id) {
      return { valid: false, username, session_id, protocol };
    }

    const valid =
      !!username && (await ng_check_session({ username, session_id }));
    return { valid, username, session_id, protocol };
  }

  // If no auth header or session query parameters, user's not logged in in any way.
  if (!auth)
    return { valid: false, username: null, session_id: null, protocol };

  // Check basic authorization header
  const [type, value] = auth.split(' ');
  if (type !== 'Basic')
    return { valid: false, username: null, session_id: null, protocol };

  const decoded = atob(value);
  const [username, session_id] = decoded.split(':');

  // DEV_MODE accepts any kind of session/username
  if (DEV_MODE) return { username, session_id, valid: true, protocol };

  const valid = await ng_check_session({ username, session_id });

  return { username, session_id, valid, protocol };
};

const ng_request = async ({
  component,
  session_id,
}: { component: string; session_id: string }) => {
  if (!NG_APP_ID) {
    NG_APP_ID = Deno.env.get('NG_APP_ID');
    DEV_MODE = Deno.env.get('DEV_MODE') === 'true';
  }

  const data = {
    app_id: NG_APP_ID,
    session_id,
    execute: {
      component,
    },
  };

  const body = new URLSearchParams();
  body.set('request', JSON.stringify(data));

  return await fetch('https://www.newgrounds.io/gateway_v3.php', {
    body,
    method: 'POST',
  });
};

/**
 * Checks the user's NG session. Returns true if session exists
 * and the username matches it.
 */
export const ng_check_session = async ({
  username,
  session_id,
}: { username?: string | null; session_id?: string | null }) => {
  try {
    if (!username || !session_id) return false;

    if (DEV_MODE) {
      logger.info('dev mode. skip validating NG session.');
      return true;
    }

    if (!DEV_MODE && !NG_APP_ID) {
      logger.error('No NG_APP_ID found. Add it to your environment');
      return false;
    }

    // If correct session found in cache return true.
    if (session_id && session_id_cache[username] === session_id) {
      return true;
    }

    const res = await ng_request({ component: 'App.checkSession', session_id });

    const res_json = await res.json();
    if (!res_json) {
      return false;
    }

    if (!res_json.success || !res_json.result.data.success) return false;

    const session = res_json.result.data.session;

    if (!session.user) return false;

    const valid = session.user.name === username && !session.expired;
    if (valid) {
      session_id_cache[username] = session_id;
    }

    return valid;
  } catch {
    return false;
  }
};

export const ng_ping = async (session_id: string) => {
  const res = await ng_request({
    component: 'Gateway.ping',
    session_id,
  });

  await res.json();
};
