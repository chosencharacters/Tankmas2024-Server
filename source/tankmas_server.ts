import config from '../config.json' with { type: 'json' };
import WebsocketHandler from './websocket_handler.ts';
import Room from './room.ts';
import TankmasDB from './tankmas_db.ts';
import User from './user.ts';
import {
  EventType,
  type PlayerDefinition,
  type MultiplayerEvent,
  type CustomEvent,
} from './messages.ts';

const certFile = 'ca/cert.pem';
const keyFile = 'ca/key.pem';

import webserver_handler from './webserver_handler.ts';

export type ConfigFile = typeof config & {
  ng_app_id?: string;
  ng_app_secret?: string;
  use_tls?: boolean;
};

const DB_WRITE_INTERVAL = 10000;

class TankmasServer {
  port: number;

  websockets: WebsocketHandler;

  db: TankmasDB;

  tick_interval: number;

  rooms: { [room_id: number]: Room };

  users: User[];
  user_map: { [username: string]: User } = {};

  previous_user_states: { [username: string]: PlayerDefinition } = {};

  time_since_db_write_ms = 0;
  time_since_backup_ms = 0;

  backup_interval_ms: number;

  initial_user_state?: Omit<PlayerDefinition, 'username' | 'timestamp'>;

  exited = false;

  received_events: CustomEvent[] = [];

  config: ConfigFile;

  constructor(config: ConfigFile) {
    this.config = config;

    this.db = new TankmasDB(config.database_file, config.backup_dir);

    this.backup_interval_ms = (config.backup_interval ?? 3600) * 1000;

    this.port = config.server_port;
    this.websockets = new WebsocketHandler({
      port: config.server_port,
    });

    this.tick_interval = Math.round(1000 / config.tick_rate);

    this.users = [];
    this.rooms = {};

    if (config.initial_player_data) {
      const sp = config.initial_player_data;
      this.initial_user_state = {
        room_id: sp.room_id,
        x: sp.x,
        y: sp.y,
        data: sp.data,
      };
    }

    for (const room_info of config.rooms) {
      const room = new Room(room_info);
      this.rooms[room.id] = room;
    }
  }

  broadcast_to_room = (
    room_id: number,
    message: MultiplayerEvent,
    immediate = false
  ) => {
    const room = this.rooms[room_id];
    if (!room) return;
    for (const user of room.user_list) {
      this.websockets.send_to_user(user.username, message, immediate);
    }
  };

  refresh_room_users = () => {
    for (const room of Object.values(this.rooms)) {
      room.user_list = this.users.filter(u => u.room_id === room.id);
    }
  };

  run = async () => {
    await this.db.init();

    this.websockets.addListener('client_connected', this._client_connected);
    this.websockets.addListener(
      'client_disconnected',
      this._client_disconnected
    );

    this.websockets.addListener('client_message', this._client_message);

    const port = this.config.server_port;
    const options = this.config.use_tls
      ? {
          port,
          keyFormat: 'pem',
          key: Deno.readTextFileSync(keyFile),
          cert: Deno.readTextFileSync(certFile),
        }
      : {
          port,
        };

    Deno.serve(options, async (req, info) => {
      try {
        const res = await this.websockets.handle_request(req, info);
        if (res) return res;

        return webserver_handler(req, this);
      } catch (error) {
        console.error(error);
        return new Response(null, { status: 500 });
      }
    });

    const on_shutdown = (is_dev = false) => {
      if (this.exited) return;
      this.exited = true;

      console.info('Server shutting down. Saving things to DB...\n');
      this.write_to_db();

      if (!is_dev) Deno.exit();
    };

    // Deno.addSignalListener('SIGBREAK', () => on_shutdown());
    Deno.addSignalListener('SIGINT', () => on_shutdown());
    globalThis.addEventListener('unload', () => on_shutdown(true));

    this.tick();
  };

  tick = () => {
    const updated_users: User[] = [];
    for (const user of this.users) {
      if (user.dirty || user.just_joined) {
        user.dirty = false;
        updated_users.push(user);
      }
    }

    this.refresh_room_users();

    const partial_state_updates: {
      room_id: number;
      event: MultiplayerEvent;
    }[] = [];

    for (const user of updated_users) {
      if (!user.room_id) continue;

      const previous_state = this.previous_user_states[user.username];
      const current_state = user.get_definition();
      const data = !previous_state
        ? current_state
        : user.get_definition_diff(previous_state);

      // If user just connected, or switches rooms
      if (
        user.just_joined ||
        (previous_state?.room_id &&
          previous_state.room_id !== current_state.room_id)
      ) {
        user.just_joined = false;

        const old_room_id = previous_state?.room_id;
        const new_room_id = current_state?.room_id;

        const switched_rooms = old_room_id !== new_room_id;

        if (switched_rooms && old_room_id) {
          console.info(`user ${user.username} left room ${old_room_id}`);
          this.broadcast_to_room(old_room_id, {
            type: EventType.PlayerLeft,
            data: {
              username: user.username,
            },
          });
        }

        // Send all existing players to new user
        if (new_room_id) {
          if (this.rooms[new_room_id]) {
            for (const other_user of this.rooms[new_room_id].user_list) {
              if (user.username === other_user.username) continue;
              this.websockets.send_to_user(user.username, {
                type: EventType.PlayerStateUpdate,
                data: { ...other_user.get_definition(), immediate: true },
              });
            }
          }
        }
      }

      this.previous_user_states[user.username] = current_state;

      if (!current_state.room_id) continue;

      partial_state_updates.push({
        room_id: current_state.room_id,
        event: {
          type: EventType.PlayerStateUpdate,
          data: { ...data, username: user.username },
        },
      });
    }

    for (const { room_id, event } of partial_state_updates) {
      this.broadcast_to_room(room_id, event);
    }

    this.websockets.flush_queues();

    this.time_since_db_write_ms += this.tick_interval;
    if (this.time_since_db_write_ms >= DB_WRITE_INTERVAL) {
      this.write_to_db();
    }

    setTimeout(this.tick, this.tick_interval);
  };

  _client_message = (
    username: string,
    event: MultiplayerEvent,
    _socket: WebSocket
  ) => {
    const user = this.user_map[username];
    if (!user) {
      console.error(`received event form non existent user ${username}`);
      return;
    }

    if (event.type === EventType.PlayerStateUpdate) {
      const new_room_id = event.data.room_id;
      const room_id =
        new_room_id && this.rooms[new_room_id] ? new_room_id : user.room_id;
      user.set_definition({ ...event.data, username, room_id });
    }

    // Currently just broadcast custom events to everyone,
    // but make sure the username is set to the actual player.
    if (event.type === EventType.CustomEvent && user.room_id) {
      console.info(`got custom event ${event.name} from ${username}`);

      const event_with_room_id = {
        ...event,
        username: user.username,
        room_id: user.room_id,
      };

      this.received_events.push(event_with_room_id);

      this.broadcast_to_room(user.room_id, event_with_room_id);
    }
  };

  _client_connected = (username: string, _socket: WebSocket) => {
    const user = new User({ username });
    user.just_joined = true;

    this.db.create_user(username, this.initial_user_state);

    const existing = this.db.get_user(username);
    if (existing) {
      existing.x = this.initial_user_state?.x;
      existing.y = this.initial_user_state?.y;
      user.set_definition(existing);
    }

    this.user_map[username] = user;
    this.users = Object.values(this.user_map);
    this.refresh_room_users();

    console.info(`${username} connected`);
  };

  _client_disconnected = (username: string) => {
    const user = this.user_map[username];
    if (!user) {
      console.error(`Tried disconnecting non existent user ${username}`);
      return;
    }

    // Write the current data to db when they disconnect.
    this.db.update_user(user);

    delete this.user_map[username];
    delete this.previous_user_states[username];

    this.users = Object.values(this.user_map);
    this.refresh_room_users();

    this.websockets.broadcast({
      type: EventType.PlayerLeft,
      data: user.get_definition(),
    });

    console.info(`${username} disconnected`);
  };

  write_to_db = () => {
    this.time_since_db_write_ms = 0;
    this.time_since_backup_ms += DB_WRITE_INTERVAL;

    const users = this.users.map(user => user.get_definition());

    this.db.update_users(users);

    if (this.received_events.length > 0) {
      this.db.add_events(this.received_events);
      this.received_events = [];
    }

    if (this.time_since_backup_ms >= this.backup_interval_ms) {
      this.time_since_backup_ms = 0;
      this.db.backup();
      console.info('Created backup of database.');
    }
  };
}

export default TankmasServer;
