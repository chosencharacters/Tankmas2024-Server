import config from '../config.json' with { type: 'json' };
import WebsocketHandler from './websocket_handler.ts';
import InputLoop from 'https://deno.land/x/input@2.0.4/index.ts';
import Room from './entities/room.ts';
import User, { UserState } from './entities/user.ts';
import TankmasDB from './tankmas_db.ts';
import {
  EventType,
  type PlayerDefinition,
  type MultiplayerEvent,
  type CustomEvent,
} from './messages.ts';

import webserver_handler from './http/http_handler.ts';

export type ConfigFile = typeof config & {
  database_path: string;
  ng_app_id?: string;
  ng_app_secret?: string;
  use_tls?: boolean;
};

const DB_WRITE_INTERVAL = 10000;

class TankmasServer {
  websockets: WebsocketHandler;

  db: TankmasDB;

  tick_interval: number;

  _rooms: { [room_id: number]: Room };
  _users: { [username: string]: User } = {};

  user_list: User[];

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
    console.info(`Starting with config ${JSON.stringify(config, null, 2)}`);

    this.db = new TankmasDB(config.database_path, config.backup_dir);

    this.backup_interval_ms = (config.backup_interval ?? 3600) * 1000;

    this.websockets = new WebsocketHandler({
      port: config.server_port,
    });

    this.tick_interval = Math.round(1000 / config.tick_rate);

    this.user_list = [];
    this._rooms = {};

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
      this._rooms[room.id] = room;
    }
  }

  get_room = (room_id: number): Room | undefined => this._rooms[room_id];
  get_user = (username: string): User | undefined => this._users[username];

  broadcast_to_room = (
    room_id: number,
    message: MultiplayerEvent,
    immediate = false
  ) => {
    const room = this.get_room(room_id);
    if (!room) return;

    for (const user of room.user_list) {
      this.websockets.send_to_user(user.username, message, immediate);
    }
  };

  send_server_notification = (text: string, persistent = false) => {
    this.websockets.broadcast({
      type: EventType.NotificationMessage,
      data: {
        text,
        persistent,
      },
    });
  };

  run = () => {
    this.websockets.addListener('client_connected', this._client_connected);
    this.websockets.addListener(
      'client_disconnected',
      this._client_disconnected
    );

    this.websockets.addListener('client_message', this._client_message);

    const certFile = Deno.env.get('CA_CERT_FILE') ?? 'ca/cert.pem';
    const keyFile = Deno.env.get('CA_KEY_FILE') ?? 'ca/key.pem';

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

    console.info(options.port);
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
      this._write_to_db();

      if (!is_dev) Deno.exit();
    };

    Deno.addSignalListener('SIGINT', () => on_shutdown());
    globalThis.addEventListener('unload', () => on_shutdown(true));

    this.tick();

    this.await_command();
  };

  input = new InputLoop();

  await_command = async () => {
    console.info('>');
    const full_command = await this.input.read(false);
    const [name, ...args] = full_command.split(' ');
    if (name === 'broadcast') {
      const rest = args.join(' ');
      if (rest) {
        console.info(`broadcasting message "${rest}"`);
        this.send_server_notification(rest);
      }
    }
    this.await_command();
  };

  tick = () => {
    const updated_users: User[] = [];
    for (const user of this.user_list) {
      // Server is still waiting for user.
      if (user.state === UserState.WaitingForInitialState) {
        continue;
      }

      if (user.dirty) {
        user.dirty = false;
        updated_users.push(user);
      }
    }

    this._refresh_room_users();

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
        user.state === UserState.RequestsFullRoomUpdate ||
        (previous_state?.room_id &&
          previous_state.room_id !== current_state.room_id)
      ) {
        user.state = UserState.Joined;

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
          const room = this.get_room(new_room_id);
          if (room) {
            for (const other_user of room.user_list) {
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
      this._write_to_db();
    }

    setTimeout(this.tick, this.tick_interval);
  };

  _client_message = (
    username: string,
    event: MultiplayerEvent,
    _socket: WebSocket
  ) => {
    const user = this.get_user(username);
    if (!user) {
      console.error(`received event form non existent user ${username}`);
      return;
    }

    if (event.type === EventType.PlayerStateUpdate) {
      const new_room_id = event.data.room_id;
      const room_id =
        new_room_id && this._rooms[new_room_id] ? new_room_id : user.room_id;

      const changed_rooms = room_id !== user.room_id;

      if (changed_rooms || user.state === UserState.WaitingForInitialState) {
        user.state = UserState.RequestsFullRoomUpdate;
      }

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

    this.db.create_user(username, this.initial_user_state);

    const existing = this.db.get_user(username);
    if (existing) {
      existing.x = this.initial_user_state?.x;
      existing.y = this.initial_user_state?.y;
      user.set_definition(existing);
    }

    this._users[username] = user;
    this.user_list = Object.values(this._users);
    this._refresh_room_users();

    console.info(`${username} connected`);
  };

  _client_disconnected = (username: string) => {
    const user = this.get_user(username);
    if (!user) {
      console.error(`Tried disconnecting non existent user ${username}`);
      return;
    }

    // Write the current data to db when they disconnect.
    this.db.update_user(user);

    delete this._users[username];
    delete this.previous_user_states[username];

    this.user_list = Object.values(this._users);
    this._refresh_room_users();

    this.websockets.broadcast({
      type: EventType.PlayerLeft,
      data: user.get_definition(),
    });

    console.info(`${username} disconnected`);
  };

  _refresh_room_users = () => {
    for (const room of Object.values(this._rooms)) {
      room.user_list = this.user_list.filter(u => u.room_id === room.id);
    }
  };

  _write_to_db = () => {
    this.time_since_db_write_ms = 0;
    this.time_since_backup_ms += DB_WRITE_INTERVAL;

    const users = this.user_list.map(user => user.get_definition());

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
