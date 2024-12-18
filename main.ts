import * as dotenv from 'jsr:@std/dotenv';

const vals = dotenv.loadSync();
for (const [k, v] of Object.entries(vals)) {
  Deno.env.set(k, v);
}

import config from './config.json' with { type: 'json' };
import TankmasServer from './source/tankmas_server.ts';
import './source/logger.ts';

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const use_tls = Deno.env.get('USE_TLS') === 'true';

  const ng_app_id = Deno.env.get('NG_APP_ID');
  const ng_app_secret = Deno.env.get('NG_APP_SECRET');

  const port = Deno.env.get('SERVER_PORT');
  const server_port = port ? Number.parseInt(port) : config.server_port;

  const dev_mode = Deno.env.has('DEV_MODE')
    ? Deno.env.get('DEV_MODE') === 'true'
    : config.dev_mode;

  const data_dir = Deno.env.get('DATA_DIR') ?? config.data_dir;

  const database_file = Deno.env.get('DATABASE_FILE') ?? config.database_file;
  const database_path = `${data_dir}/${database_file}`;
  const backup_dir = `${data_dir}/${config.backup_dir}`;

  const server = new TankmasServer({
    ...config,
    data_dir,
    backup_dir,
    database_path,
    server_port,
    use_tls,
    ng_app_id,
    ng_app_secret,
    dev_mode,
  });

  await server.run();
}
