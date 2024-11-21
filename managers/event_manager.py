import json
import time
from pathlib import Path
import os

from tools import load_json, write_json

current_events_path = "data/events/events.json"
archived_events_path = "data/events/events-archive.json"
requests_log_path = "data/events/requests-log.json"

events = ["sticker"]

max_before_archive = 5

timestamp_diff_limit = 9999

Path("data/events").mkdir(parents=True, exist_ok=True)

for file_path in [current_events_path, archived_events_path]:
    if not os.path.isfile(file_path):
        with open(current_events_path, "w") as file:
            write_json(file_path, {"events": []})

if not os.path.isfile(requests_log_path):
    write_json(requests_log_path, {"requests": []})


class EventManager:
    def __init__(self):
        self.access_log = {}
        pass
        # with open(current_events_path, "r") as file:
        # self.events_log = json.loads()

    def archive_all(self):
        pass

    def get_current_events(self) -> dict:
        return load_json(current_events_path)

    def get_archived_events(self) -> dict:
        return load_json(archived_events_path)

    def get_request_log(self) -> dict:
        return load_json(requests_log_path)

    def write_event(self, event) -> list:

        events = load_json(current_events_path)["events"]
        events.append(event)

        write_json(current_events_path, {"events": events})

        return events

    def event(self, username: str, event_type: str, data):
        timestamp = time.time()

        event = {
            "timestamp": timestamp,
            "event": event_type,
            "data": data,
            "username": username,
        }

        self.write_event(event)

    def get_events_since(self, username: str, timestamp: int):
        prev_timestamp = timestamp
        events_since = []

        for entry in self.get_request_log()["requests"]:
            if entry["username"] == username:
                prev_timestamp = entry["timestamp"]

        for event in self.get_current_events()["events"]:
            if event["timestamp"] > prev_timestamp and username != entry["username"]:
                events_since.append(event)

        self.log_request(username, timestamp)

    def log_request(self, username: str, timestamp: int):
        entry = {"username": username, "timestamp": timestamp}

        data = self.get_request_log()
        data["requests"].append(entry)

        print(data)

        write_json(requests_log_path, data)
