"""
Restocking recommendations and in-memory restock order store.

Recommendations are computed from demand forecasts: for every item whose
forecasted demand exceeds current demand, the shortfall is a restock candidate.
Candidates are filled greedily into the user's budget.
"""

import math
import threading
from datetime import datetime, timedelta
from typing import Any

# Lower value = restocked first. Rising demand is the most urgent to cover;
# items with falling demand are only bought once everything else is covered.
TREND_PRIORITY: dict[str, int] = {"increasing": 0, "stable": 1, "decreasing": 2}
UNKNOWN_TREND_PRIORITY = len(TREND_PRIORITY)

MAX_RESTOCK_BUDGET = 1_000_000
ORDER_NUMBER_PREFIX = "RST"
ORDER_STATUS_SUBMITTED = "Submitted"

# Submitted restock orders live only in process memory (cleared on restart),
# consistent with the rest of this demo which never writes to the data files.
submitted_orders: list[dict[str, Any]] = []

# Bound memory use: the API is unauthenticated, so without a cap repeated POSTs
# could grow this list forever.
MAX_SUBMITTED_ORDERS = 500

# FastAPI runs sync routes in a thread pool, so "next sequence number" and
# "append" must happen atomically or two concurrent submits could share an id.
_orders_lock = threading.Lock()


class OrderLimitReached(Exception):
    """Raised when the in-memory order store is full."""


def _round_money(value: float) -> float:
    return round(value, 2)


def _candidates(forecasts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return restock candidates (positive shortfall only), sorted by urgency."""
    candidates = [
        {
            "sku": f["item_sku"],
            "name": f["item_name"],
            "trend": f["trend"],
            "unit_cost": f["unit_cost"],
            "lead_time_days": f["lead_time_days"],
            "shortfall": f["forecasted_demand"] - f["current_demand"],
        }
        for f in forecasts
    ]
    # Items whose forecast is at or below current demand need no restock.
    positive = [c for c in candidates if c["shortfall"] > 0]

    # Sort by trend first, then by the money needed to cover the full shortfall
    # (largest first) so the biggest exposures within a trend are handled first.
    return sorted(
        positive,
        key=lambda c: (
            TREND_PRIORITY.get(c["trend"], UNKNOWN_TREND_PRIORITY),
            -(c["shortfall"] * c["unit_cost"]),
        ),
    )


def _line(candidate: dict[str, Any], quantity: int) -> dict[str, Any]:
    return {
        "sku": candidate["sku"],
        "name": candidate["name"],
        "trend": candidate["trend"],
        "quantity": quantity,
        "unit_cost": candidate["unit_cost"],
        "line_total": _round_money(quantity * candidate["unit_cost"]),
        "lead_time_days": candidate["lead_time_days"],
    }


def build_recommendation(forecasts: list[dict[str, Any]], budget: float) -> dict[str, Any]:
    """Recommend restock quantities that fit within ``budget``.

    Pure function: ``forecasts`` is not modified.
    """
    candidates = _candidates(forecasts)
    max_useful_budget = sum(c["shortfall"] * c["unit_cost"] for c in candidates)

    lines: list[dict[str, Any]] = []
    remaining = budget
    for candidate in candidates:
        # Greedy fill: take the full shortfall if affordable, otherwise as many
        # whole units as the remaining budget allows. If not even one unit fits
        # we skip the item but keep going, since a cheaper item later may fit.
        affordable = math.floor(remaining / candidate["unit_cost"] + 1e-9)
        quantity = min(candidate["shortfall"], affordable)
        if quantity <= 0:
            continue
        line = _line(candidate, quantity)
        lines = [*lines, line]
        remaining -= line["line_total"]

    total_cost = _round_money(sum(line["line_total"] for line in lines))
    return {
        "budget": budget,
        "lines": lines,
        "total_cost": total_cost,
        "remaining_budget": _round_money(max(budget - total_cost, 0)),
        "max_useful_budget": _round_money(max_useful_budget),
    }


def create_order(recommendation: dict[str, Any], now: datetime, sequence: int) -> dict[str, Any]:
    """Build a restock order from a recommendation.

    The whole order ships together, so its lead time is the slowest line's.
    """
    lines = recommendation["lines"]
    if not lines:
        raise ValueError("Cannot create a restock order without lines")
    lead_time_days = max(line["lead_time_days"] for line in lines)
    return {
        "id": f"rst-{sequence}",
        "order_number": f"{ORDER_NUMBER_PREFIX}-{now.year}-{sequence:04d}",
        "lines": lines,
        "total_cost": recommendation["total_cost"],
        "budget": recommendation["budget"],
        "status": ORDER_STATUS_SUBMITTED,
        "submitted_date": now.isoformat(),
        "lead_time_days": lead_time_days,
        "expected_delivery": (now + timedelta(days=lead_time_days)).isoformat(),
    }


def submit_order(recommendation: dict[str, Any], now: datetime) -> dict[str, Any]:
    """Create an order and store it, assigning the next sequence number."""
    with _orders_lock:
        if len(submitted_orders) >= MAX_SUBMITTED_ORDERS:
            raise OrderLimitReached(f"Order limit of {MAX_SUBMITTED_ORDERS} reached")
        order = create_order(recommendation, now, len(submitted_orders) + 1)
        submitted_orders.append(order)
        return order
