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
