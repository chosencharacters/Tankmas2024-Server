import json
import time
import math
from pathlib import Path

user_def_vals = ["x", "y", "costume", "sx"]
base_client_tick_rate = 500


class HitManager:
    def __init__(self):
        self.hits = 0
        self.attrition_rate = 5
        self.interval = 1
        self.last_update_timestamp = 0
        self.current_client_tick_rate = base_client_tick_rate

    def hit(self) -> int:
        self.hits = self.hits + 1
        return self.hits

    def update_attrition_rate(self) -> int:
        self.attrition_rate = math.floor(self.hits / self.attrition_rate)
        if self.attrition_rate < 1:
            self.attrition_rate = 1

        return self.attrition_rate

    def get_tick_rate(self) -> int:
        return self.client_tick_rate

    def update_tick_rate(self) -> int:
        timestamp = time.time()

        if timestamp - self.last_update_timestamp >= self.interval:
            self.update_attrition_rate()
            self.client_tick_rate = base_client_tick_rate * self.attrition_rate
            self.hits = 0
            self.last_hits_update_time = timestamp
