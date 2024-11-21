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
    write_json(requests_log_path, {"entries": []})


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

    def event(self, username: str, event_type: str, data):
        timestamp = time.time()

        event = {
            "timestamp": timestamp,
            "event": event_type,
            "data": data,
            "username": username,
        }

        self.write_event(event)

    def get_events_since(self, username: str, current_timestamp: int) -> dict:
        prev_timestamp = 0
        events_since = []

        for entry in self.get_request_log()["entries"]:
            if entry["username"] == username:
                prev_timestamp = entry["timestamp"]

        compare_timestamp = prev_timestamp if prev_timestamp > 0 else current_timestamp

        print(prev_timestamp, current_timestamp, prev_timestamp == compare_timestamp)

        for event in self.get_current_events()["events"]:
            if username != entry["username"]:
                if event["timestamp"] > compare_timestamp:
                    events_since.append(event)

        self.log_request(username, current_timestamp)

        return events_since

    def write_event(self, event) -> list:

        data = self.get_current_events()
        events = data["events"]

        print(events)

        exists_already = False
        for n in range(0, len(events)):
            if events[n]["username"] == event["username"]:
                if events[n]["event"] == event["event"]:
                    events[n] = event
                    exists_already = True
                    break

        if not exists_already:
            events.append(event)

        events = sorted(events, key=lambda n: n["timestamp"])

        data["events"] = events
        write_json(current_events_path, data)

        return events

    def log_request(self, username: str, timestamp: int):
        data = self.get_request_log()
        entries = data["entries"]

        exists_already = False
        for existing_entry in entries:
            if existing_entry["username"] == username:
                existing_entry["timestamp"] = timestamp
                exists_already = True
                break

        if not exists_already:
            new_entry = {"username": username, "timestamp": timestamp}
            entries.append(new_entry)

        entries = sorted(entries, key=lambda d: d["timestamp"])

        data["entries"] = entries

        write_json(requests_log_path, data)
