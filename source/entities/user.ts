import type { PlayerDefinition } from '../messages.ts';

export enum UserState {
  WaitingForInitialState = 0,
  Joined = 1,
  RequestsFullRoomUpdate = 2,
}

class User {
  username: string;

  state: UserState = UserState.WaitingForInitialState;

  x = 0;
  y = 0;
  sx = 1;

  costume?: string;

  data: { [name: string]: unknown } = {};

  room_id?: number;

  timestamp = Date.now();

  total_online_time = 0;
  current_session_time = 0;

  dirty = false;

  constructor({ username }: { username: string }) {
    this.username = username;
  }

  set_definition = (d: PlayerDefinition) => {
    const old = this.get_definition();

    this.x = d.x ?? this.x;
    this.y = d.y ?? this.y;
    this.sx = d.sx ?? this.sx;

    this.costume = d.costume ?? this.costume;

    if (d.data) {
      this.data = {
        ...this.data,
        ...d.data,
      };
    }

    this.room_id = d.room_id ?? this.room_id;

    const diff = this.get_definition_diff(old);
    const changed_keys = Object.values(diff).filter(v => v !== undefined);
    const modified = changed_keys.length > 0;

    this.dirty = modified;

    this.timestamp = Date.now();
  };

  get_definition = (): PlayerDefinition => {
    const { username, x, y, sx, costume, data, room_id, timestamp } = this;
    return {
      username,
      x,
      y,
      sx,
      costume,
      data: { ...data },
      room_id,
      timestamp,
    };
  };

  get_definition_diff = (
    previous: PlayerDefinition
  ): Omit<PlayerDefinition, 'username'> => {
    const definition = this.get_definition();

    const { x, y, sx, costume, data, room_id, timestamp } = definition;

    const p = previous;

    const previous_data = p.data ?? {};

    const modified_data_entries = data
      ? Object.entries(data).filter(([name, value]) => {
          const previous_value = previous_data[name as keyof PlayerDefinition];
          return previous_value !== value;
        })
      : undefined;

    const modified_data = modified_data_entries?.length
      ? Object.fromEntries(modified_data_entries)
      : undefined;

    return {
      x: p.x !== x ? x : undefined,
      y: p.y !== y ? y : undefined,
      sx: p.sx !== sx ? sx : undefined,
      costume: p.costume !== costume ? costume : undefined,
      room_id: p.room_id !== room_id ? room_id : undefined,
      timestamp: p.timestamp !== timestamp ? timestamp : undefined,
      data: modified_data,
    };
  };
}

export default User;
