import json


def write_json(file_path: str, data: dict):
    try:
        file = open(file_path, "w")
        file.write(json.dumps(data, indent=4))
        file.close()
        # print("Data written successfully.")
    except IOError:
        print(f"JSON WRITE ERROR @ {file_path}\n\t\tdata: {data}")

def load_json(file_path: str) -> dict:
    try:
        file = open(file_path, "r")
        data = json.load(file)
        file.close()
        return data
        # print("Data written successfully.")
    except IOError:
        print(f"JSON LOAD ERROR @ {file_path}")

def write_string(file_path: str, data: str):
    try:
        file = open(file_path, "w")
        file.write(data)
        file.close()
    except IOError:
        print(f"STRING WRITE ERROR @ {file_path}\n\t\tdata: {data}")

def load_string(file_path: str) -> str:
    try:
        file = open(file_path, "r")
        data = file.read()
        file.close()
        return data
    except IOError:
        print(f"STRING LOAD ERROR @ {file_path}")

def has_file(file_path: str) -> bool:
    try:
        file = open(file_path, "r")
        file.close()
        return True
    except IOError:
        return False