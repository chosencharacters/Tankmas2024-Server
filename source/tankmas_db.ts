import { DB } from 'https://deno.land/x/sqlite@v3.9.1/mod.ts';
import * as path from 'jsr:@std/path';
import type { CustomEvent, FullPlayerDefinition } from './messages.ts';
import { format } from 'jsr:@std/datetime';
import type User from './entities/user.ts';

/**
 * Contains methods for reading and writing values to DB
 */
class TankmasDB {
  db: DB;

  db_path: string;
  backup_dir: string;

  constructor(db_path: string, backup_dir: string) {
    Deno.mkdirSync(path.dirname(db_path), { recursive: true });
    this.db = new DB(db_path);
    this.db_path = db_path;
    this.backup_dir = backup_dir;

    this.run_migrations();
  }

  initiate_user_session = (username: string, session_id: string) => {
    if (!username || !session_id) return;
    const last_sign_in_time = Date.now();
    this.db.query(
      `UPDATE users 
      SET 
        session_id = :session_id,
        last_sign_in_time = :last_sign_in_time
      WHERE username=:username`,
      { username, session_id, last_sign_in_time }
    );
  };

  get_user_sessions = (): { [username: string]: string } => {
    const session_timeout_time = Date.now() - 60 * 1000 * 10;
    const res = this.db.query<[string, string]>(
      `SELECT username, session_id 
      FROM users
      WHERE session_id NOT NULL
      AND last_timestamp > :session_timeout_time`,
      { session_timeout_time }
    );

    const session_map: { [username: string]: string } = {};
    for (const [username, session_id] of res) {
      session_map[username] = session_id;
    }

    return session_map;
  };

  create_user = (username: string, session_id: string) => {
    const [created] = this.db.query(
      `INSERT INTO users(username) 
      VALUES(:username)
      ON CONFLICT(username) DO NOTHING
      RETURNING id
    `,
      { username }
    );

    this.initiate_user_session(username, session_id);

    return !!created;
  };

  update_users = (users: User[]) => {
    const db = this.db;
    const values = users.map(user => {
      const {
        x,
        y,
        sx,
        costume,
        data,
        username,
        room_id,
        timestamp,
        total_online_time,
        current_session_time,
      } = user;

      return {
        x,
        y,
        sx,
        costume,
        data: JSON.stringify(data),
        room_id,
        timestamp,
        username,
        total_online_time,
        current_session_time,
      };
    });

    const q = db.prepareQuery(
      `UPDATE users SET
        x = :x,
        y = :y,
        sx = :sx,
        costume = :costume,
        data = :data,
        room_id = :room_id,
        last_timestamp = :timestamp,
        total_online_time = :total_online_time,
        current_session_time = :current_session_time
      WHERE username = :username
    `
    );

    for (const v of values) q.execute(v);
  };

  update_user = (user: User) => {
    return this.update_users([user]);
  };

  add_event = (event: CustomEvent) => this.add_events([event]);

  add_events = (events: CustomEvent[]) => {
    const statement = this.db.prepareQuery(`INSERT INTO events(
        type, 
        room_id,
        user_id,
        data,
        timestamp
      )
      VALUES(
        :type,
        :room_id,
        (select id from users where username=:username),
        :data,
        :timestamp
      )
      `);
    for (const event of events) {
      const {
        username,
        room_id,
        name: type,
        data: data_obj,
        timestamp,
      } = event;

      const data = data_obj ? JSON.stringify(data_obj) : undefined;

      statement.execute({
        type,
        room_id,
        username,
        data,
        timestamp,
      });
    }
  };

  get_user = (username: string): FullPlayerDefinition | undefined => {
    const [user] = this.db.query<
      [
        number, // x
        number, // y
        number, // sx
        string | undefined, // costume
        number | undefined, // room_id
        string | undefined, // data
        number, // total_online_time
        number, // current_session_time
      ]
    >(
      `SELECT 
        x,
        y,
        sx,
        costume,
        room_id,
        data,
        total_online_time,
        current_session_time
       FROM users 
       WHERE username=?`,
      [username]
    );

    if (!user) return undefined;

    const [
      x,
      y,
      sx,
      costume,
      room_id,
      data_string,
      total_online_time,
      current_session_time,
    ] = user;
    const data = JSON.parse(data_string ?? '{}');

    return {
      username,
      x,
      y,
      sx,
      costume,
      room_id,
      data,
      total_online_time,
      current_session_time,
    };
  };

  get_user_save = (username: string): string | undefined => {
    const [res] = this.db.query<[string]>(
      `SELECT data FROM saves WHERE username=?`,
      [username]
    );

    return res ? res[0] : undefined;
  };

  store_user_save = (username: string, data: string) => {
    this.db.query<[string]>(
      `INSERT INTO saves(username, data, save_time) VALUES(:username, :data, :timestamp)
            ON CONFLICT(username) DO UPDATE SET data=:data, save_time=:timestamp;`,
      { username, data, timestamp: Date.now() }
    );
  };

  backup = () => {
    Deno.mkdirSync(this.backup_dir, { recursive: true });
    const now = new Date();
    const formatted_date = format(now, 'yyyy-MM-dd_HHmmss');
    const name = `${formatted_date}.backup.db`;
    Deno.copyFile(this.db_path, `${this.backup_dir}/${name}`);
  };

  /**
   * migrations are numbered, and will run once in numerical order.
   * this is so that we can make modifications to the DB structure
   * automatically on startup.
   */
  run_migrations = () => {
    // Run initialization query to create tables if none exist
    const initial_query = Deno.readTextFileSync('migrations/initial.sql');
    this.db.execute(initial_query);

    const migration_file_names = [];
    for (const f of Deno.readDirSync('migrations')) {
      if (!f.isFile) continue;
      if (f.name === 'initial.sql') continue;
      migration_file_names.push(f.name);
    }
    const sorted = migration_file_names.sort((a, b) => a.localeCompare(b));
    const names = this.db.query<[string]>(`SELECT name from migrations`);

    for (const migration_name of sorted) {
      if (names?.find(n => n[0] === migration_name)) continue;
      const query = Deno.readTextFileSync(`migrations/${migration_name}`);
      logger.info(`Running migration ${migration_name}`);
      this.db.execute(query);
      this.db.query(`INSERT INTO migrations(name) VALUES(:migration_name);`, {
        migration_name,
      });
    }
  };
}

export default TankmasDB;
