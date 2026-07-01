from elasticsearch import Elasticsearch

es = Elasticsearch(['http://elastic:changeme@localhost:9200'])
resp = es.transport.perform_request('POST', '/_security/user/kibana_system/_password', headers={'Content-Type': 'application/json'}, body={'password':'changeme'})
print(resp)
