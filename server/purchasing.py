"""
In-memory store for purchase orders raised against backlog (shortage) items.

The store is seeded from data/purchase_orders.json at startup. New orders live
only in process memory, consistent with the rest of this demo.
"""

import threading
from datetime import date, datetime
from typing import Any

from mock_data import purchase_orders as seed_purchase_orders

STATUS_PENDING = "Pending"

# The API is unauthenticated, so cap the store to keep memory bounded.
MAX_PURCHASE_ORDERS = 500

# FastAPI runs sync routes in a thread pool; the duplicate check and the insert
# must happen atomically or two concurrent requests could both create a PO.
_lock = threading.Lock()
_orders: tuple[dict[str, Any], ...] = tuple(dict(po) for po in seed_purchase_orders)


class PurchaseOrderLimitReached(Exception):
    """Raised when the in-memory purchase order store is full."""


class DuplicatePurchaseOrder(Exception):
    """Raised when the backlog item already has a purchase order."""


def find_by_backlog_item(backlog_item_id: str) -> dict[str, Any] | None:
    """Return the purchase order for a backlog item, or None."""
    po = next((po for po in _orders if po["backlog_item_id"] == backlog_item_id), None)
    return dict(po) if po else None


def create_order(
    backlog_item_id: str,
    supplier_name: str,
    quantity: int,
    unit_cost: float,
    expected_delivery_date: date,
    notes: str | None,
    now: datetime,
) -> dict[str, Any]:
    """Create and store a purchase order; at most one per backlog item."""
    global _orders
    with _lock:
        if find_by_backlog_item(backlog_item_id) is not None:
            raise DuplicatePurchaseOrder(
                f"Backlog item {backlog_item_id} already has a purchase order"
            )
        if len(_orders) >= MAX_PURCHASE_ORDERS:
            raise PurchaseOrderLimitReached(
                f"Purchase order limit of {MAX_PURCHASE_ORDERS} reached"
            )
        order = {
            "id": f"PO-{now.year}-{len(_orders) + 1:04d}",
            "backlog_item_id": backlog_item_id,
            "supplier_name": supplier_name,
            "quantity": quantity,
            "unit_cost": unit_cost,
            "expected_delivery_date": expected_delivery_date.isoformat(),
            "status": STATUS_PENDING,
            "created_date": now.isoformat(),
            "notes": notes,
        }
        _orders = (*_orders, order)
        return dict(order)


def reset_orders() -> None:
    """Restore the store to the seed data (used by tests)."""
    global _orders
    with _lock:
        _orders = tuple(dict(po) for po in seed_purchase_orders)
