
from tools import load_json

from datetime import datetime

premiere_file = "data/premieres.json"

'''
example json file:
{
  "premieres": {
    "november": {
      "time": "2024-11-30 11:12AM",
      "url": "https://uploads.ungrounded.net/alternate/6243000/6243882_alternate_289698.720p.mp4?1732833997"
    },
    "test_movie": {
      "time": "2024-11-30 06:22PM",
      "url": "https://uploads.ungrounded.net/alternate/6243000/6243882_alternate_289698.720p.mp4?1732833997"
    }
  }
}
'''

class PremiereManager:
	def __init__(self) -> None:
		premiere_data = load_json(premiere_file)
		if premiere_data["premieres"] is None:
			raise Exception("No premieres found")
		self.premieres = premiere_data["premieres"]

	def get_all(self):
		res = [] 
		now = datetime.now()
		for name in self.premieres:
			p = self.premieres[name]
			time = p["time"]
			release_date = datetime.strptime(time, '%Y-%m-%d %I:%M%p')
			print(release_date)

			delta = (release_date - now).total_seconds()

			prem =  {
				"release_timestamp": (release_date.timestamp()).__int__(),
				"name": name,
				"date": time,
			}
			
			if delta <= 0:
				prem["url"] = p["url"]

			res.append(prem);

		return {"data": res};
	
	def get_premiere(self, name) -> dict:
		premiere = self.premieres[name]

	pass