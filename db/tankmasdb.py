import sqlite3
from pathlib import Path
from flask import g
import json
import time
import shutil
import datetime

DATABASE = 'data/tankmas.db'
INIT_FILE = 'db/init.sql'
BACKUP_DIR = 'backups'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db

class TankmasDb:
    def close(self):
        db = get_db()
        if db is not None:
            db.close()

    def __init__(self, config):
        self.room_infos = {}
        self.backup_interval = config["backup_interval"] if "backup_interval" in config else 1800
        self.last_backup = time.time()
        self.max_idle_time = config["user_max_idle_time"]

    def init(self, config, app):
        print("Initializing DB...")
        self.init_db(app)
        self.user_def_vals = config["user_def_vals"]
        
        self.user_event_timestamps = {}

        for r in config["rooms"]: 
            self.upsert_room(r["id"], r["name"], r["identifier"])
            self.room_infos[r["id"]] = {
               "name": r["name"],
               "id": r["id"],
               "identifier": r["identifier"],
               "maps": r["maps"],
            }

    def init_db(self, app):
        db = get_db()
        with app.open_resource(INIT_FILE, mode='r') as f:
            init_script = f.read()
            print(init_script)
            db.cursor().executescript(init_script)
        print("Inited DB")
            
    def upsert_room(self, room_id, room_identifier, room_name):
        db = get_db()
        cur = db.cursor()
        cur.execute("""
        INSERT INTO rooms(id, identifier, name) VALUES(?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name=?, identifier=?;
        """, [room_id, room_identifier, room_name, room_name, room_identifier])
        db.commit()
    
    def get_room(self, room_id):
        db = get_db()
        cur = db.cursor()

        cur.execute("""
            SELECT 
                u.username, u.x, u.y, u.costume, u.sx, u.data, 
                last_timestamp
            FROM users u
            WHERE u.room_id = ?
            AND u.last_timestamp > ?
        """, (room_id, time.time() - self.max_idle_time))
        
        users = {} 
        for row in cur:
            user_data = {}
            if row[5] is not None:
                user_data = json.loads(row[5])
            users[row[0]] = {
                "username": row[0],
                "x": row[1],
                "y": row[2],
                "costume": row[3],
                "sx": row[4],
                "data": user_data,
                "timestamp": row[6]
            }
        
        room_info = self.room_infos[int(room_id)]
        return {
            "room_id": room_id,
            "room_name": room_info["name"],
            "maps": room_info["maps"],
            "users": users
        }
    
    def upsert_user(self, username, room_id, x = None, y = None, sx = None, costume = None, data = None):
        db = get_db()
        cur = db.cursor()

        cur.execute("""
        INSERT INTO users(username, room_id) VALUES(?, ?)
            ON CONFLICT(username) DO UPDATE SET room_id=?;
        """, (username, room_id, room_id))

        field_names = []
        field_values = []
        if x is not None:
            field_names.append('x=?')
            field_values.append(x)
        if y is not None:
            field_names.append('y=?')
            field_values.append(y)
        if sx is not None:
            field_names.append('sx=?')
            field_values.append(sx)
        if costume is not None:
            field_names.append('costume=?')
            field_values.append(costume)
        if data is not None:
            field_names.append('data=?')
            field_values.append(json.dumps(data))

        field_values.append(username)
        set_statement = ", ".join(field_names)
        if set_statement != "":
            set_statement = set_statement + ", "
        query = "UPDATE users SET "+set_statement+"""
            last_timestamp=unixepoch('now','subsec')
            WHERE username = ?
            RETURNING x, y, costume, sx
            """
        cur.execute(query, field_values)

        request_for_more_info = False

        for r in cur:
            user = {
                "x": r[0],
                "y": r[1],
                "costume": r[2],
                "sx": r[3]
            }
            
            for val in self.user_def_vals:
                if val not in user:
                    request_for_more_info = True

        db.commit()

        return request_for_more_info
    
    def log_event():
        pass
    
    def post_event(self, username, event_type, data, room_id = None):
        db = get_db()
        cur = db.cursor()

        cur.execute("""
        INSERT INTO events(timestamp, username, type, data, room_id) VALUES(unixepoch('now','subsec'), ?, ?, ?, ?)
        """, (username, event_type, json.dumps(data), room_id))
        db.commit()
    
    def get_new_events(self, username, room_id):
        last_timestamp = self.user_event_timestamps[username] if username in self.user_event_timestamps else time.time()
        self.user_event_timestamps[username] = time.time()
        
        db = get_db()
        cur = db.cursor()
        cur.execute("""
            SELECT username, type, room_id, timestamp, data
            FROM events WHERE
                timestamp >= ?
            AND
                room_id = ?
        """, (last_timestamp, room_id))
        
        events = []
        for e in cur:
            events.append({
                "username": e[0],
                "type": e[1],
                "room_id": e[2],
                "timestamp": e[3],
                "data": json.loads(e[4]) if e[4] is not None else None,
            })
        
        return events
    
    def get_user(self, username):
        db = get_db()
        cur = db.cursor()
        cur.execute("""
            SELECT 
                u.username, u.x, u.y, u.costume, u.sx, u.data, 
                u.last_timestamp, u.room_id, r.name
            FROM users u
            JOIN rooms r on r.id = u.room_id
            WHERE u.username = ?
        """, [username])
        
        user = None
        for row in cur:
            user_data = {}
            if row[5] is not None:
                user_data = json.loads(row[5])
            user = {
                "username": row[0],
                "x": row[1],
                "y": row[2],
                "costume": row[3],
                "sx": row[4],
                "data": user_data,
                "timestamp": row[6],
                "room_id": row[7],
                "room_name": row[8]
            }
        return user
    
    def save_user_file(self, username, data):
        db = get_db()
        cur = db.cursor()

        cur.execute("""
        INSERT INTO saves(username, data, save_time) VALUES(?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(username) DO UPDATE SET data=?, save_time=CURRENT_TIMESTAMP;
        """, [username, data, data])
        db.commit()

    def load_user_file(self, username):
        db = get_db()
        cur = db.cursor()

        cur.execute("""
        SELECT data FROM saves
        WHERE username = ?
        """, [username])
        
        data = None;
        for s in cur:
            data = s[0]

        return data

    def backup(self):
        Path(BACKUP_DIR).mkdir(parents=True, exist_ok=True)
        backup_name = datetime.datetime.now().strftime("%Y-%m-%d-%H%M%S-backup.db")
        shutil.copy(DATABASE, f"{BACKUP_DIR}/{backup_name}")
        pass
    
    def process(self):
        cur_time = time.time()
        delta = cur_time - self.last_backup
        if delta > self.backup_interval:
            self.last_backup = cur_time
            self.backup()