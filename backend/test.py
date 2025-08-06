import requests

payload = { 'api_key': '0fb11588de3b424c10af02e4719f6042', 'url': 'https://www.studylight.org/' }
r = requests.get('https://api.scraperapi.com/', params=payload)
print(r.text)






