"""
Tests for the purchase order API endpoints used by the Dashboard "Create PO" flow.
"""
import pytest

import purchasing

VALID_PO = {
    "backlog_item_id": "1",
    "supplier_name": "Acme Filters Ltd",
    "quantity": 350,
    "unit_cost": 12.5,
    "expected_delivery_date": "2025-11-15",
    "notes": "Rush order",
}


@pytest.fixture(autouse=True)
def reset_purchase_orders():
    """Keep the in-memory purchase order store isolated between tests."""
    purchasing.reset_orders()
    yield
    purchasing.reset_orders()


class TestPurchaseOrderEndpoints:
    """Test suite for /api/purchase-orders."""

    def test_create_purchase_order(self, client):
        response = client.post("/api/purchase-orders", json=VALID_PO)
        assert response.status_code == 201

        po = response.json()
        assert po["backlog_item_id"] == "1"
        assert po["supplier_name"] == "Acme Filters Ltd"
        assert po["quantity"] == 350
        assert po["unit_cost"] == 12.5
        assert po["expected_delivery_date"] == "2025-11-15"
        assert po["notes"] == "Rush order"
        assert po["status"] == "Pending"
        assert isinstance(po["id"], str)
        assert "T" in po["created_date"]

    def test_get_purchase_order_by_backlog_item(self, client):
        created = client.post("/api/purchase-orders", json=VALID_PO).json()

        response = client.get("/api/purchase-orders/1")
        assert response.status_code == 200
        assert response.json() == created

    def test_get_purchase_order_none_exists(self, client):
        response = client.get("/api/purchase-orders/1")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_create_for_unknown_backlog_item(self, client):
        response = client.post("/api/purchase-orders", json={**VALID_PO, "backlog_item_id": "nope"})
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_duplicate_purchase_order_rejected(self, client):
        client.post("/api/purchase-orders", json=VALID_PO)
        response = client.post("/api/purchase-orders", json=VALID_PO)
        assert response.status_code == 409

    @pytest.mark.parametrize("payload", [
        {**VALID_PO, "quantity": 0},
        {**VALID_PO, "quantity": -5},
        {**VALID_PO, "unit_cost": 0},
        {**VALID_PO, "supplier_name": ""},
        {**VALID_PO, "supplier_name": "   "},
        {**VALID_PO, "expected_delivery_date": "15/11/2025"},
        {**VALID_PO, "notes": "x" * 1001},
        {"backlog_item_id": "1"},
    ])
    def test_create_purchase_order_invalid_input(self, client, payload):
        response = client.post("/api/purchase-orders", json=payload)
        assert response.status_code == 422

    def test_backlog_reflects_purchase_order(self, client):
        before = {b["id"]: b for b in client.get("/api/backlog").json()}
        assert before["1"]["has_purchase_order"] is False
        assert before["1"]["purchase_order_id"] is None

        po = client.post("/api/purchase-orders", json=VALID_PO).json()

        after = {b["id"]: b for b in client.get("/api/backlog").json()}
        assert after["1"]["has_purchase_order"] is True
        assert after["1"]["purchase_order_id"] == po["id"]
        assert after["2"]["has_purchase_order"] is False
