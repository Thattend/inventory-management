"""
Tests for restocking recommendation logic and API endpoints.
"""
import copy
from datetime import datetime, timedelta

import pytest
import restocking
from restocking import build_recommendation, create_order

# Small, hand-checkable forecast set used by the unit tests.
SAMPLE_FORECASTS = [
    {"id": "1", "item_sku": "AAA-1", "item_name": "Stable Big", "current_demand": 100,
     "forecasted_demand": 110, "trend": "stable", "period": "Next 30 days",
     "unit_cost": 100.0, "lead_time_days": 20},
    {"id": "2", "item_sku": "BBB-2", "item_name": "Rising Small", "current_demand": 10,
     "forecasted_demand": 15, "trend": "increasing", "period": "Next 30 days",
     "unit_cost": 10.0, "lead_time_days": 5},
    {"id": "3", "item_sku": "CCC-3", "item_name": "Falling", "current_demand": 50,
     "forecasted_demand": 40, "trend": "decreasing", "period": "Next 30 days",
     "unit_cost": 1.0, "lead_time_days": 3},
    {"id": "4", "item_sku": "DDD-4", "item_name": "Rising Big", "current_demand": 0,
     "forecasted_demand": 20, "trend": "increasing", "period": "Next 30 days",
     "unit_cost": 25.0, "lead_time_days": 9},
]


@pytest.fixture(autouse=True)
def clear_submitted_orders():
    """Keep the in-memory order store isolated between tests."""
    restocking.submitted_orders.clear()
    yield
    restocking.submitted_orders.clear()


class TestBuildRecommendation:
    """Unit tests for the pure recommendation function."""

    def test_zero_budget_returns_no_lines(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 0)
        assert rec["lines"] == []
        assert rec["total_cost"] == 0
        assert rec["remaining_budget"] == 0

    def test_large_budget_covers_all_shortfalls(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 1_000_000)
        quantities = {line["sku"]: line["quantity"] for line in rec["lines"]}
        assert quantities == {"AAA-1": 10, "BBB-2": 5, "DDD-4": 20}
        assert abs(rec["total_cost"] - 1550.0) < 0.01

    def test_negative_shortfall_excluded(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 1_000_000)
        assert "CCC-3" not in [line["sku"] for line in rec["lines"]]

    def test_max_useful_budget_is_cost_of_all_shortfalls(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 0)
        assert abs(rec["max_useful_budget"] - 1550.0) < 0.01

    def test_increasing_trend_items_come_first(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 1_000_000)
        skus = [line["sku"] for line in rec["lines"]]
        # Within "increasing", larger shortfall value (DDD-4: 500) beats BBB-2 (50).
        assert skus == ["DDD-4", "BBB-2", "AAA-1"]

    def test_partial_last_line_stays_within_budget(self):
        # 530: DDD-4 fully (500), then 30 left buys 3 of BBB-2 (10 each);
        # 0 left, so AAA-1 (100) is skipped.
        rec = build_recommendation(SAMPLE_FORECASTS, 530)
        assert rec["total_cost"] <= 530
        quantities = {line["sku"]: line["quantity"] for line in rec["lines"]}
        assert quantities == {"DDD-4": 20, "BBB-2": 3}

    def test_partial_quantity_for_expensive_item(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 850)
        quantities = {line["sku"]: line["quantity"] for line in rec["lines"]}
        # 850 - 550 = 300 left, buys 3 of AAA-1 at 100.
        assert quantities["AAA-1"] == 3
        assert abs(rec["remaining_budget"] - 0) < 0.01

    def test_line_totals_match_quantity_times_cost(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 850)
        for line in rec["lines"]:
            assert abs(line["line_total"] - line["quantity"] * line["unit_cost"]) < 0.01

    def test_does_not_mutate_input(self):
        original = copy.deepcopy(SAMPLE_FORECASTS)
        build_recommendation(SAMPLE_FORECASTS, 850)
        assert SAMPLE_FORECASTS == original


class TestCreateOrder:
    """Unit tests for turning a recommendation into an order."""

    def test_lead_time_is_slowest_line(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 1_000_000)
        now = datetime(2025, 10, 1, 9, 0, 0)
        order = create_order(rec, now, 1)
        assert order["lead_time_days"] == 20
        assert order["expected_delivery"] == (now + timedelta(days=20)).isoformat()
        assert order["submitted_date"] == now.isoformat()

    def test_empty_recommendation_raises(self):
        with pytest.raises(ValueError):
            create_order(build_recommendation(SAMPLE_FORECASTS, 0), datetime(2025, 10, 1), 1)

    def test_order_number_and_status(self):
        rec = build_recommendation(SAMPLE_FORECASTS, 1_000_000)
        order = create_order(rec, datetime(2025, 10, 1), 7)
        assert order["order_number"] == "RST-2025-0007"
        assert order["status"] == "Submitted"
        assert abs(order["total_cost"] - rec["total_cost"]) < 0.01


class TestRestockingEndpoints:
    """API tests for /api/restocking/*."""

    def test_demand_forecasts_include_cost_and_lead_time(self, client):
        data = client.get("/api/demand").json()
        for forecast in data:
            assert isinstance(forecast["unit_cost"], (int, float))
            assert forecast["unit_cost"] > 0
            assert isinstance(forecast["lead_time_days"], int)
            assert forecast["lead_time_days"] > 0

    def test_get_recommendations(self, client):
        response = client.get("/api/restocking/recommendations?budget=2000")
        assert response.status_code == 200

        data = response.json()
        for field in ["budget", "lines", "total_cost", "remaining_budget", "max_useful_budget"]:
            assert field in data
        assert data["total_cost"] <= 2000
        assert len(data["lines"]) > 0

    def test_get_recommendations_rejects_negative_budget(self, client):
        response = client.get("/api/restocking/recommendations?budget=-5")
        assert response.status_code == 422

    def test_get_recommendations_requires_budget(self, client):
        response = client.get("/api/restocking/recommendations")
        assert response.status_code == 422

    def test_create_order(self, client):
        response = client.post("/api/restocking/orders", json={"budget": 2000})
        assert response.status_code == 201

        order = response.json()
        assert order["order_number"].startswith("RST-")
        assert order["status"] == "Submitted"
        assert order["total_cost"] <= 2000
        max_lead = max(line["lead_time_days"] for line in order["lines"])
        assert order["lead_time_days"] == max_lead

        submitted = datetime.fromisoformat(order["submitted_date"])
        expected = datetime.fromisoformat(order["expected_delivery"])
        assert expected - submitted == timedelta(days=max_lead)

    def test_create_order_ignores_client_prices(self, client):
        """Extra fields like prices are not part of the request contract."""
        response = client.post(
            "/api/restocking/orders",
            json={"budget": 2000, "lines": [{"sku": "WDG-001", "unit_cost": 0.01, "quantity": 99999}]},
        )
        assert response.status_code == 201
        expected = client.get("/api/restocking/recommendations?budget=2000").json()
        assert response.json()["lines"] == expected["lines"]

    def test_create_order_rejects_budget_above_max(self, client):
        too_big = restocking.MAX_RESTOCK_BUDGET + 1
        assert client.post("/api/restocking/orders", json={"budget": too_big}).status_code == 422
        assert client.get(f"/api/restocking/recommendations?budget={too_big}").status_code == 422

    def test_create_order_limit_returns_409(self, client, monkeypatch):
        monkeypatch.setattr(restocking, "MAX_SUBMITTED_ORDERS", 1)
        assert client.post("/api/restocking/orders", json={"budget": 1000}).status_code == 201
        response = client.post("/api/restocking/orders", json={"budget": 1000})
        assert response.status_code == 409
        assert "limit" in response.json()["detail"].lower()

    def test_create_order_budget_too_small(self, client):
        response = client.post("/api/restocking/orders", json={"budget": 0.5})
        assert response.status_code == 400
        assert "detail" in response.json()

    def test_create_order_missing_body(self, client):
        response = client.post("/api/restocking/orders", json={})
        assert response.status_code == 422

    def test_create_order_rejects_non_positive_budget(self, client):
        response = client.post("/api/restocking/orders", json={"budget": 0})
        assert response.status_code == 422

    def test_list_orders_newest_first(self, client):
        assert client.get("/api/restocking/orders").json() == []

        first = client.post("/api/restocking/orders", json={"budget": 1000}).json()
        second = client.post("/api/restocking/orders", json={"budget": 3000}).json()

        data = client.get("/api/restocking/orders").json()
        assert [o["id"] for o in data] == [second["id"], first["id"]]
        assert first["order_number"] != second["order_number"]
