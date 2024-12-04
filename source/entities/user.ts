import type { PlayerDefinition } from "../messages.ts";

class User {
	username: string;

	x = 0;
	y = 0;
	sx = 1;

	costume?: string;

	data: Record<string, unknown> = {};

	room_id?: number;

	timestamp = Date.now();

	dirty = false;

	just_joined = false;

	constructor({ username }: { username: string }) {
		this.username = username;
	}

	set_definition = (d: PlayerDefinition) => {
		const old = this.get_definition();

		this.x = d.x ?? this.x;
		this.y = d.y ?? this.y;
		this.sx = d.sx ?? this.sx;

		this.costume = d.costume ?? this.costume;

		this.data = d.data ?? this.data;

		this.room_id = d.room_id ?? this.room_id;

		const diff = this.get_definition_diff(old);
		const changed_keys = Object.values(diff).filter((v) => v !== undefined);
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
			data,
			room_id,
			timestamp,
		};
	};

	get_definition_diff = (
		previous: PlayerDefinition,
	): Omit<PlayerDefinition, "username"> => {
		const { x, y, sx, costume, data, room_id, timestamp } = this;
		const p = previous;
		return {
			x: p.x !== x ? x : undefined,
			y: p.y !== y ? y : undefined,
			sx: p.sx !== sx ? sx : undefined,
			costume: p.costume !== costume ? costume : undefined,
			room_id: p.room_id !== room_id ? room_id : undefined,
			timestamp: p.timestamp !== timestamp ? timestamp : undefined,
			data: p.data !== data ? data : undefined,
		};
	};
}

export default User;
