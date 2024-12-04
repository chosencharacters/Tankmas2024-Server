import { DB } from 'https://deno.land/x/sqlite@v3.9.1/mod.ts';
import * as path from 'jsr:@std/path';
import type { CustomEvent, PlayerDefinition } from './messages.ts';
import { format } from 'jsr:@std/datetime';

class TankmasDB {
  db: DB;

  db_path: string;
  backup_dir: string;

  constructor(db_path: string, backup_dir: string) {
    Deno.mkdirSync(path.dirname(db_path), { recursive: true });
    this.db = new DB(db_path);
    this.db_path = db_path;
    this.backup_dir = backup_dir;
  }

  init = async () => {
    const initial_query = await Deno.readTextFile('migrations/initial.sql');
    await this.db.execute(initial_query);
  };

  create_user = (
    username: string,
    default_values?: Omit<PlayerDefinition, 'username' | 'timestamp'>
  ) => {
    const [created] = this.db.query(
      `INSERT INTO users(username) 
      VALUES(:username)
      ON CONFLICT(username) DO NOTHING
      RETURNING id
    `,
      { username }
    );

    if (created && default_values) {
      const current = this.get_user(username);
      const new_def = {
        username,
        ...current,
        ...default_values,
      };

      this.update_user(new_def);
    }
  };

  update_users = (users: PlayerDefinition[]) => {
    const db = this.db;
    const values = users.map(user => {
      const { x, y, sx, costume, data, username, room_id, timestamp } = user;

      return {
        x,
        y,
        sx,
        costume,
        data: JSON.stringify(data),
        room_id,
        timestamp,
        username,
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
        last_timestamp = :timestamp
      WHERE username = :username
    `
    );

    for (const v of values) q.execute(v);
  };

  update_user = (user: PlayerDefinition) => {
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

  get_user = (username: string): PlayerDefinition | undefined => {
    const [user] = this.db.query<
      [
        number,
        number,
        number,
        string | undefined,
        number | undefined,
        string | undefined,
      ]
    >(
      `SELECT 
        x,
        y,
        sx,
        costume,
        room_id,
        data
       FROM users 
       WHERE username=?`,
      [username]
    );

    if (!user) return undefined;

    const [x, y, sx, costume, room_id, data_string] = user;
    const data = JSON.parse(data_string ?? '{}');

    return {
      username,
      x,
      y,
      sx,
      costume,
      room_id,
      data,
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
}

export default TankmasDB;
