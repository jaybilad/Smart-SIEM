from elasticsearch import Elasticsearch

es = Elasticsearch(['http://elastic:changeme@localhost:9200'])
print(es.info())
