
CREATE TABLE IF NOT EXISTS rooms (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	identifier TEXT NOT NULL UNIQUE
);


CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	room_id INTEGER,
	session_id TEXT,
	username TEXT NOT NULL UNIQUE,
	costume TEXT,
	x INT,
	y INT,
	sx INT,
	last_timestamp INTEGER DEFAULT CURRENT_TIMESTAMP,
	data JSONB not null default '{}'
);


CREATE TABLE IF NOT EXISTS events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	room_id INTEGER,
	timestamp INTEGER DEFAULT CURRENT_TIMESTAMP,
	user_id INT,
	type TEXT,
	data jsonb not null default '{}'
);

-- insert into events select eo.id, CAST((eo.timestamp * 1000) AS INTEGER) timestamp, (select id from users where username=eo.username) user_id, eo.type, eo.room_id, eo.data from events_old eo;

CREATE TABLE IF NOT EXISTS saves (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT UNIQUE NOT NULL,
	data text default '',
	save_time DATETIME DEFAULT CURRENT_TIMESTAMP
)