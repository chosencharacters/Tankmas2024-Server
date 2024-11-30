from flask import Flask, request, jsonify
from threading import Lock
import threading
import os
import time

from managers import HitManager, RoomManager, EventManager,PremiereManager

# from queue import Queue
# from threading import Thread

# number_of_room_threads = 5  ### obviously this is configurable
# room_queue = Queue()


rooms = RoomManager()
events = EventManager()
hits = HitManager()

premieres = PremiereManager()

app = Flask(__name__)

server_background_update_interval = 1

# events.post_event("tankman", "murder", {"yea": 0})
# print(events.get_events_since("tankman", time.time()))

# Room data structure with a thread lock for concurrency safety
# rooms = {"room_id": 1, "room_name": "Room 1", "users": []}
# rooms_lock = Lock()

rooms_being_accessed = []


# Endpoint to join/update position in a room
@app.route("/rooms/<room_id>/users", methods=["POST"])
def update_room(room_id) -> dict:
    # while room_id in rooms_being_accessed:
    #      x = 2

    rooms_being_accessed.append(room_id)

    request_for_more_info = rooms.write_user_to_room(room_id, request.json)

    hits.hit()

    package = {
        "tick_rate": hits.get_tick_rate(),
        "data": {"request_for_more_info": request_for_more_info},
    }

    rooms_being_accessed.remove(room_id)

    return jsonify(package), 200


@app.route("/rooms/<room_id>", methods=["GET"])
def get_room(room_id) -> dict:
    room = rooms.get_room(room_id)

    hits.hit()

    package = {"tick_rate": hits.get_tick_rate(), "data": room}
    return jsonify(package), 200


@app.route("/rooms/<room_id>/users", methods=["GET"])
def get_room_users(room_id) -> dict:
    users = rooms.get_room_users(room_id)

    hits.hit()

    package = {"tick_rate": hits.get_tick_rate(), "data": users}
    return jsonify(package), 200


@app.route("/rooms/<room_id>/events/post", methods=["POST"])
def post_room_event(room_id) -> dict:
    hits.hit()

    event = request.json

    print(event)

    events.post_event(event["username"], event["type"], event["data"])

    package = {"tick_rate": hits.get_tick_rate()}
    return jsonify(package), 200


@app.route("/rooms/<room_id>/events/get", methods=["POST"])
def get_room_events(room_id) -> dict:
    hits.hit()

    events_array = events.get_events_since(request.json["username"], time.time())

    package = {"tick_rate": hits.get_tick_rate(), "data": {"events": events_array}}
    return jsonify(package), 200


def server_background_tasks():
    hits.update_tick_rate()
    threading.Timer(server_background_update_interval, server_background_tasks).start()
    rooms.cleanup_old_users()


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

