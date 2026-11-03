"""
Tests for the tasks API endpoints used by the Tasks modal in App.vue.
"""
import pytest

import tasks

VALID_TASK = {"title": "Check Q4 stock levels", "priority": "high", "dueDate": "2025-10-08"}


@pytest.fixture(autouse=True)
def clear_tasks():
    """Keep the in-memory task store isolated between tests."""
    tasks.clear_tasks()
    yield
    tasks.clear_tasks()


class TestTasksEndpoints:
    """Test suite for /api/tasks."""

    def test_get_tasks_empty(self, client):
        response = client.get("/api/tasks")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_task(self, client):
        response = client.post("/api/tasks", json=VALID_TASK)
        assert response.status_code == 201

        task = response.json()
        assert task["title"] == VALID_TASK["title"]
        assert task["priority"] == "high"
        # The frontend reads camelCase dueDate, so the API must return it that way.
        assert task["dueDate"] == "2025-10-08"
        assert task["status"] == "pending"
        assert isinstance(task["id"], str)

    def test_created_task_is_listed_newest_first(self, client):
        first = client.post("/api/tasks", json=VALID_TASK).json()
        second = client.post("/api/tasks", json={**VALID_TASK, "title": "Second"}).json()

        listed = client.get("/api/tasks").json()
        assert [t["id"] for t in listed] == [second["id"], first["id"]]

    def test_task_ids_are_unique(self, client):
        ids = {client.post("/api/tasks", json=VALID_TASK).json()["id"] for _ in range(3)}
        assert len(ids) == 3

    def test_title_is_trimmed(self, client):
        response = client.post("/api/tasks", json={**VALID_TASK, "title": "  Padded  "})
        assert response.status_code == 201
        assert response.json()["title"] == "Padded"

    @pytest.mark.parametrize("payload", [
        {**VALID_TASK, "title": ""},
        {**VALID_TASK, "title": "   "},
        {**VALID_TASK, "title": "x" * 201},
        {**VALID_TASK, "priority": "urgent"},
        {**VALID_TASK, "dueDate": "08/10/2025"},
        {**VALID_TASK, "dueDate": "2025-13-40"},
        {"title": "Missing fields"},
    ])
    def test_create_task_invalid_input(self, client, payload):
        response = client.post("/api/tasks", json=payload)
        assert response.status_code == 422

    def test_toggle_task(self, client):
        task = client.post("/api/tasks", json=VALID_TASK).json()

        toggled = client.patch(f"/api/tasks/{task['id']}")
        assert toggled.status_code == 200
        assert toggled.json()["status"] == "completed"

        toggled_back = client.patch(f"/api/tasks/{task['id']}")
        assert toggled_back.json()["status"] == "pending"

    def test_toggle_does_not_mutate_previous_response(self, client):
        task = client.post("/api/tasks", json=VALID_TASK).json()
        client.patch(f"/api/tasks/{task['id']}")
        assert client.get("/api/tasks").json()[0]["status"] == "completed"
        assert task["status"] == "pending"

    def test_delete_task(self, client):
        task = client.post("/api/tasks", json=VALID_TASK).json()

        response = client.delete(f"/api/tasks/{task['id']}")
        assert response.status_code == 200
        assert response.json()["id"] == task["id"]
        assert client.get("/api/tasks").json() == []

    def test_toggle_nonexistent_task(self, client):
        response = client.patch("/api/tasks/nonexistent-999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_delete_nonexistent_task(self, client):
        response = client.delete("/api/tasks/nonexistent-999")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_task_limit(self, client, monkeypatch):
        monkeypatch.setattr(tasks, "MAX_TASKS", 2)
        client.post("/api/tasks", json=VALID_TASK)
        client.post("/api/tasks", json=VALID_TASK)

        response = client.post("/api/tasks", json=VALID_TASK)
        assert response.status_code == 409
