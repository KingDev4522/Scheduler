"""Configurable priority policy (Phase 3 §4).

The default order and role caps come from the dataset. An administrator may
override the order with a JSON file; the engine never silently changes it.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

CATEGORIES = (
    "exam",
    "regular_session",
    "institute_event",
    "guest_lecture",
    "department_event",
    "club_event",
)


@dataclass(frozen=True)
class Policy:
    priority_order: tuple[str, ...]
    role_category_cap: dict[str, str]
    version: str

    @classmethod
    def from_dataset(cls, data, path: str | Path | None = None) -> "Policy":
        order = list(data.priority_order)
        version = "dataset-default"
        if path is not None:
            raw = json.loads(Path(path).read_text(encoding="utf-8"))
            candidate = raw.get("priority_order")
            if not isinstance(candidate, list) or sorted(candidate) != sorted(CATEGORIES):
                raise ValueError(
                    f"policy priority_order must be a permutation of {list(CATEGORIES)}"
                )
            order = candidate
            version = str(raw.get("version", Path(path).name))
        return cls(tuple(order), dict(data.role_cap), version)

    def effective_category(self, req: dict) -> str:
        cap = self.role_category_cap.get(req["role"], "club_event")
        requested = (
            self.priority_order.index(req["requested_category"])
            if req["requested_category"] in self.priority_order
            else len(self.priority_order) - 1
        )
        return self.priority_order[max(requested, self.priority_order.index(cap))]

    def outranks(self, r1: dict, r2: dict) -> bool:
        c1 = self.priority_order.index(self.effective_category(r1))
        c2 = self.priority_order.index(self.effective_category(r2))
        if c1 != c2:
            return c1 < c2
        return r1["submitted_at"] < r2["submitted_at"]
