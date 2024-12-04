from pathlib import Path

from tools import write_string, load_string, has_file

save_folder = "data/saves"

class SaveManager:
	def __init__(self) -> None:
		Path(save_folder).mkdir(parents=True, exist_ok=True)

	def set_save(self, user_id, user_data):
		write_string(f"{save_folder}/{user_id}.sol", user_data)

	def get_save(self, user_id):
		if not has_file(f"{save_folder}/{user_id}.sol"):
			return None

		return load_string(f"{save_folder}/{user_id}.sol")

