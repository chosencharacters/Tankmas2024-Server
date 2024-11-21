import json
import time
from pathlib import Path

events = ["sticker"]


class EventManager:
    def __init__(self):
        self.events = {}

    def log(self, event_type, data, username):
        timestamp = time.time()
