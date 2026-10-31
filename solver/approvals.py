"""Approval metadata and authorization for booking decisions (Phase 3 §9).

The official export keeps only the fields the validator requires. Approval
metadata (actor, time, policy version) is written to a separate artifact.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .policy import Policy


class ApprovalError(ValueError):
    pass


def finalize_decisions(
    data,
    decisions: list[dict],
    policy: Policy,
    *,
    approver: str = "admin",
    approver_role: str = "admin",
) -> tuple[list[dict], list[dict]]:
    """Return (export_decisions, approval_records).

    Enforces requester != approver and that only an Admin may approve or offer
    an alternative. The export rows keep the exact shape the README specifies.
    """
    export_rows: list[dict] = []
    records: list[dict] = []
    now = datetime.now(timezone.utc).isoformat()

    for decision in decisions:
        request_id = decision["request_id"]
        req = data.requests.get(request_id)
        if req is None:
            raise ApprovalError(f"unknown request {request_id}")

        status = decision["status"]
        if status in ("approved", "alternative_offered"):
            if approver_role != "admin":
                raise ApprovalError(
                    f"role {approver_role!r} may not approve {request_id}; only Admin may decide"
                )
            requester = str(req.get("requester", "")).strip()
            if requester.lower() == approver.strip().lower():
                raise ApprovalError(
                    f"self-approval blocked: {request_id} was requested by {requester}"
                )
            records.append(
                {
                    "request_id": request_id,
                    "status": status,
                    "decided_by": approver,
                    "decided_role": approver_role,
                    "decided_at": now,
                    "policy_version": policy.version,
                    "policy_order": list(policy.priority_order),
                    "reason": decision.get("reason", ""),
                }
            )

        row = {"request_id": request_id, "status": status}
        for key in ("day", "start_period", "end_period", "room_id", "reason"):
            if key in decision:
                row[key] = decision[key]
        export_rows.append(row)

    return export_rows, records
