import requests

BASE_URL = "http://localhost:8080"  # Or EC2/public IP

def test_health_check():
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200

def test_get_records():
    # You need to know the baseName and modelId from your running NocoDB instance
    base = "project_db"
    model = "tasks"
    r = requests.get(f"{BASE_URL}/api/v3/data/{base}/{model}/records")
    assert r.status_code == 200
    assert isinstance(r.json(), dict)
