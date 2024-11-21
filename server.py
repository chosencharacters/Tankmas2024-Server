from flask import Flask, request, jsonify
from threading import Lock
import threading
import os
import time

from managers import HitManager, RoomManager, EventManager


rooms = RoomManager()
events = EventManager()
hits = HitManager()

app = Flask(__name__)

events.event("tankman", "murder", {"yea": 0})
server_background_update_interval = 1

print(events.get_events_since("tankman", time.time()))

# Room data structure with a thread lock for concurrency safety
# rooms = {"room_id": 1, "room_name": "Room 1", "users": []}
# rooms_lock = Lock()


# Endpoint to join/update position in a room
@app.route("/rooms/<room_id>/users", methods=["POST"])
def update_room(room_id) -> dict:
    request_for_more_info = rooms.write_user_to_room(room_id, request.json)

    hits.hit()

    package = {
        "tick_rate": hits.get_tick_rate(),
        "data": {"request_for_more_info": request_for_more_info},
    }

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


def server_background_tasks():
    hits.update_tick_rate()
    threading.Timer(server_background_update_interval, server_background_tasks).start()
    rooms.cleanup_old_users()


server_background_tasks()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=os.getenv("SERVER_PORT"))
