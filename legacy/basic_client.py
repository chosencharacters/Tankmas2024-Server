import requests

# The API endpoint
url = "http://127.0.0.1:5000/rooms/1/users"

# Data to be sent
data = {"name": "paco from pacos school 2", "x": 69, "y": 420, "costume": "paco"}

# A POST request to the API
response = requests.post(url, json=data)

# Print the response
print(response)

if response.status_code == 200:
    print(response.json())
