import redis
import sys

def test_redis():
    try:
        r = redis.from_url('redis://localhost:6379', decode_responses=True)
        response = r.ping()
        if response:
            print("✅ Redis connecté !")
            r.set('test_key', 'test_value')
            value = r.get('test_key')
            print(f"✅ Redis read/write OK : {value}")
            r.delete('test_key')
            return True
    except Exception as e:
        print(f"❌ Redis erreur : {e}")
        return False

if __name__ == '__main__':
    success = test_redis()
    sys.exit(0 if success else 1)
