from flask import Flask, request, jsonify, g
from threading import Lock
import threading
import os
import time

from tools import load_json

from managers import HitManager, RoomManager, EventManager,PremiereManager, SaveManager

from db.tankmasdb import TankmasDb;

# from queue import Queue
# from threading import Thread

# number_of_room_threads = 5  ### obviously this is configurable
# room_queue = Queue()

config = load_json("config.json")

db = TankmasDb(config)

rooms = RoomManager()
events = EventManager()
saves = SaveManager()
hits = HitManager()

premieres = PremiereManager()

app = Flask(__name__)

with app.app_context():
    db.init(config, app)

from flask_cors import CORS
cors = CORS(app) # allow CORS for all domains on all routes.
app.config['CORS_HEADERS'] = 'Content-Type'

server_background_update_interval = 1

# events.post_event("tankman", "murder", {"yea": 0})
# print(events.get_events_since("tankman", time.time()))

# Room data structure with a thread lock for concurrency safety
# rooms = {"room_id": 1, "room_name": "Room 1", "users": []}
# rooms_lock = Lock()


# Endpoint to join/update position in a room
@app.route("/rooms/<room_id>/users", methods=["POST"])
def update_room(room_id) -> dict:
    
    body = request.json
    
    username = body["name"] if "name" in body else None
    x = body["x"] if "x" in body else None
    y = body["y"] if "y" in body else None
    sx = body["sx"] if "sx" in body else None
    costume = body["costume"] if "costume" in body else None
    
    hits.hit()
    
    if username is None:
        return jsonify({
            "tick_rate": hits.get_tick_rate(),
            "data": {}
        })

    request_for_more_info = db.upsert_user(username, room_id, x, y, sx, costume)
    
    package = {
        "tick_rate": hits.get_tick_rate(),
        "data": {"request_for_more_info": request_for_more_info},
    }

    return jsonify(package), 200

@app.route("/users/<username>", methods=["GET"])
def get_user(username) -> dict:
    user = db.get_user(username)

    hits.hit()

    package = {"tick_rate": hits.get_tick_rate(), "data": user}
    return jsonify(package), 200

@app.route("/rooms/<room_id>", methods=["GET"])
def get_room(room_id) -> dict:
    room = db.get_room(room_id)

    hits.hit()

    package = {"tick_rate": hits.get_tick_rate(), "data": room}
    return jsonify(package), 200


@app.route("/rooms/<room_id>/users", methods=["GET"])
def get_room_users(room_id) -> dict:
    room = db.get_room(room_id)
    
    users = room["users"] if room is not None and room["users"] is not None else {}

    hits.hit()

    package = {"tick_rate": hits.get_tick_rate(), "data": users}
    return jsonify(package), 200


@app.route("/rooms/<room_id>/events/post", methods=["POST"])
def post_room_event(room_id) -> dict:
    hits.hit()

    event = request.json

    username = event["username"] if "username" in event else None
    type = event["type"] if "type" in event else None
    data = event["data"] if "data" in event else None

    package = {"tick_rate": hits.get_tick_rate()}
    
    if username is None or type is None:
        return jsonify(package), 200

    db.post_event(username, type, data, room_id)

    return jsonify(package), 200


@app.route("/rooms/<room_id>/events/get", methods=["POST"])
def get_room_events(room_id) -> dict:
    hits.hit()

    username = request.json["username"] if "username" in request.json else None
    events_array = []
    if username is not None: 
        events_array = db.get_new_events(username, room_id)

    package = {"tick_rate": hits.get_tick_rate(), "data": {"events": events_array}}
    return jsonify(package), 200


def server_background_tasks():
    hits.update_tick_rate()
    threading.Timer(server_background_update_interval, server_background_tasks).start()

    db.process()

    rooms.cleanup_old_users()

@app.route("/saves/get", methods=["POST"])
def fetch_save() -> dict:
    hits.hit()

    event = request.json
    
    username = event["username"]
    data = db.load_user_file(username)

    if data is None:
        data = "null"

    package = {"tick_rate": hits.get_tick_rate(), "data": data}

    return jsonify(package), 200

@app.route("/saves/post", methods=["POST"])
def post_save() -> dict:
    hits.hit()

    event = request.json

    #saves.set_save(event["username"], event["data"])
    db.save_user_file(event["username"], event["data"])

    package = {"tick_rate": hits.get_tick_rate()}

    return jsonify(package), 200

@app.route("/premieres", methods=["GET"])
def get_premieres() -> dict:
    res = premieres.get_all()
    return jsonify(res), 200

server_background_tasks()

@app.route("/", methods=["GET"])
def index():
    return "Hello", 200

if __name__ == "__main__":
    use_https = os.getenv("USE_HTTPS") is not None
    
    ssl_context = None
    if use_https:
        ssl_context = ("cert/privkey.key", "cert/cert.crt")

    app.run(host="0.0.0.0", port=os.getenv("SERVER_PORT"), ssl_context=ssl_context)


@app.teardown_appcontext
def close_connection(exception):
    db.close()
    