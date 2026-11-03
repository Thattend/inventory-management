"""
In-memory store for user tasks shown in the Tasks modal.

Tasks live only in process memory (cleared on restart), consistent with the
rest of this demo which never writes to the data files.
"""

import threading
from datetime import date
from typing import Any

STATUS_PENDING = "pending"
STATUS_COMPLETED = "completed"

# The API is unauthenticated, so cap the store to keep memory bounded.
MAX_TASKS = 500

# FastAPI runs sync routes in a thread pool; read-modify-write on the store
# must be atomic so concurrent requests cannot lose updates or share an id.
_lock = threading.Lock()
_tasks: tuple[dict[str, Any], ...] = ()
_next_id = 1


class TaskLimitReached(Exception):
    """Raised when the in-memory task store is full."""


class TaskNotFound(Exception):
    """Raised when no task has the requested id."""


def list_tasks() -> list[dict[str, Any]]:
    """Return all tasks, newest first."""
    return [dict(task) for task in _tasks]


def add_task(title: str, priority: str, due_date: date) -> dict[str, Any]:
    """Create a pending task and return it."""
    global _tasks, _next_id
    with _lock:
        if len(_tasks) >= MAX_TASKS:
            raise TaskLimitReached(f"Task limit of {MAX_TASKS} reached")
        # String ids prefixed with "task-" never collide with the numeric ids of
        # the mock tasks the frontend keeps in useAuth.js.
        task = {
            "id": f"task-{_next_id}",
            "title": title,
            "priority": priority,
            "dueDate": due_date.isoformat(),
            "status": STATUS_PENDING,
        }
        _next_id += 1
        _tasks = (task, *_tasks)
        return dict(task)


def toggle_task(task_id: str) -> dict[str, Any]:
    """Flip a task between pending and completed; return the updated task."""
    global _tasks
    with _lock:
        current = _find(task_id)
        new_status = STATUS_PENDING if current["status"] == STATUS_COMPLETED else STATUS_COMPLETED
        updated = {**current, "status": new_status}
        _tasks = tuple(updated if t["id"] == task_id else t for t in _tasks)
        return dict(updated)


def delete_task(task_id: str) -> dict[str, Any]:
    """Remove a task and return it."""
    global _tasks
    with _lock:
        removed = _find(task_id)
        _tasks = tuple(t for t in _tasks if t["id"] != task_id)
        return dict(removed)


def clear_tasks() -> None:
    """Reset the store (used by tests)."""
    global _tasks, _next_id
    with _lock:
        _tasks = ()
        _next_id = 1


def _find(task_id: str) -> dict[str, Any]:
    task = next((t for t in _tasks if t["id"] == task_id), None)
    if task is None:
        raise TaskNotFound(f"Task {task_id} not found")
    return task
