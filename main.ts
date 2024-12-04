import * as dotenv from 'jsr:@std/dotenv';

const vals = dotenv.loadSync();
for (const [k, v] of Object.entries(vals)) {
  Deno.env.set(k, v);
}

import config from './config.json' with { type: 'json' };
import TankmasServer from './source/tankmas_server.ts';

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const use_tls = Deno.env.has('USE_TLS');

  const ng_app_id = Deno.env.get('NG_APP_ID');
  const ng_app_secret = Deno.env.get('NG_APP_SECRET');

  const port = Deno.env.get('SERVER_PORT');
  const server_port = port ? Number.parseInt(port) : config.server_port;

  const dev_mode = Deno.env.has('DEV_MODE')
    ? Deno.env.get('DEV_MODE') === 'true'
    : config.dev_mode;

  const server = new TankmasServer({
    ...config,
    server_port,
    use_tls,
    ng_app_id,
    ng_app_secret,
    dev_mode,
  });

  await server.run();
}
