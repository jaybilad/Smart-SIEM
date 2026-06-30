from functools import lru_cache

from app.core.config import ES_HOST


@lru_cache(maxsize=1)
def get_es_client():
    from elasticsearch import Elasticsearch

    return Elasticsearch([ES_HOST], request_timeout=30)
