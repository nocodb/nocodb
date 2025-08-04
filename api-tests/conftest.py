import pytest
import requests

BASE_URL = "http://localhost:8080"  # Change this to EC2 IP or Docker host if needed


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def http():
    """Reusable HTTP session for making API requests (handles cookies, etc.)."""
    return requests.Session()
