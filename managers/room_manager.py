import json
import time
from pathlib import Path

user_max_idle_time = 99999

from tools import load_json, write_json


class RoomManager:
    def __init__(self):
        Path("data/rooms").mkdir(parents=True, exist_ok=True)

        self.user_def_vals = ["x", "y", "costume", "sx"]

        with open("./init/rooms.json", "r") as file:
            defs = json.load(file)["defs"]
            for room in defs:
                room_file = open(f"data/rooms/{room['room_id']}.json", "w")
                base_room_data = {
                    "room_id": room["room_id"],
                    "room_name": room["room_name"],
                    "maps": room["maps"],
                    "users": {},
                }
                room_file.write(json.dumps(base_room_data, indent=4))

    def write_user_to_room(self, room_id, user) -> bool:
        room_data = self.get_room(room_id)

        user_name = user["name"]
        del user["name"]

        user["timestamp"] = time.time()

        if user_name in room_data["users"]:
            for val in self.user_def_vals:
                if val in user:
                    room_data["users"][user_name][val] = user[val]
        else:
            room_data["users"][user_name] = user

        request_for_more_info = False
        for val in self.user_def_vals:
            if val not in room_data["users"][user_name]:
                request_for_more_info = True

        self.set_room(room_id, room_data)

        return request_for_more_info

    def set_room(self, room_id, room_data):
        write_json(f"data/rooms/{room_id}.json", room_data)

    def get_room(self, room_id) -> dict:
        return load_json(f"data/rooms/{room_id}.json")

    def get_room_users(self, room_id) -> dict:
        room = self.get_room(room_id)
        return room["users"]

    def cleanup_old_users(self):
        for room_id in ["1", "2", "3"]:
            room_data = self.get_room(room_id)

            current_timestamp = time.time()

            shitlist = []

            for user_name in room_data["users"]:
                diff = current_timestamp - room_data["users"][user_name]["timestamp"]
                if diff >= user_max_idle_time:
                    shitlist.append(user_name)

            if len(shitlist) > 0:
                print(shitlist)

            for user_name in shitlist:
                del room_data["users"][user_name]

            write_json(f"data/rooms/{room_id}.json", room_data)
