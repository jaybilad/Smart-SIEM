import os


ES_HOST = os.getenv("ES_HOST", "http://elastic:changeme@localhost:9200")
ES_LOGS_INDEX = os.getenv("ES_LOGS_INDEX", "logs")
