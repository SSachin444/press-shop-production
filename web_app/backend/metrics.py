"""
Unified metric calculation helpers for PHA INDIA Press Shop System.
Single source of truth shared across Dashboard, Cell Status, Analytics, and Reports.
"""


def compute_shift_metrics(records: list[dict], machines: list[dict], downtimes: list[dict] | None = None, machine_group: str = "ALL") -> dict:
    group_upper = (machine_group or "ALL").upper()
    filtered_machines = [
        m for m in machines
        if group_upper == "ALL"
        or (group_upper == "NC" and m.get("machine_type") == "NC")
        or (group_upper == "TANDEM" and m.get("machine_type") == "Tandem")
    ]
    allowed_names = {str(m["machine_number"]).upper() for m in filtered_machines}

    filtered_records = [
        r for r in records
        if group_upper == "ALL"
        or str(r.get("machine_or_line", "")).upper() in allowed_names
        or (group_upper == "NC" and r.get("production_type") == "NC")
        or (group_upper == "TANDEM" and r.get("production_type") == "Tandem")
    ]

    open_downtimes = [
        d for d in (downtimes or [])
        if d.get("status") == "Open" and (group_upper == "ALL" or str(d.get("machine_number", "")).upper() in allowed_names)
    ]

    total_actual = sum(int(r.get("actual_qty") or 0) for r in filtered_records)
    total_target = sum(int(r.get("target_qty") or 0) for r in filtered_records)
    total_rejected = sum(int(r.get("rejected_qty") or 0) for r in filtered_records)
    total_good = sum(
        int(r["good_qty"]) if r.get("good_qty") is not None else max(0, int(r.get("actual_qty") or 0) - int(r.get("rejected_qty") or 0))
        for r in filtered_records
    )
    total_downtime = sum(int(r.get("downtime_minutes") or 0) for r in filtered_records)

    achievement_pct = round((total_actual / total_target) * 100, 1) if total_target > 0 else 0.0
    quality_pct = round((total_good / total_actual) * 100, 1) if total_actual > 0 else 0.0
    rejection_pct = round((total_rejected / total_actual) * 100, 1) if total_actual > 0 else 0.0

    affected_machines = {
        str(r.get("machine_or_line", "")).upper()
        for r in filtered_records
        if int(r.get("downtime_minutes") or 0) > 0
    } | {str(d.get("machine_number", "")).upper() for d in open_downtimes}

    running_count = 0
    maintenance_count = 0
    stopped_count = 0

    machine_rows = []
    for m in filtered_machines:
        m_num = str(m["machine_number"]).upper()
        m_recs = [r for r in filtered_records if str(r.get("machine_or_line", "")).upper() == m_num]
        m_recs.sort(key=lambda x: (str(x.get("hour_interval") or ""), int(x.get("id") or 0)))

        m_actual = sum(int(r.get("actual_qty") or 0) for r in m_recs)
        m_target = sum(int(r.get("target_qty") or 0) for r in m_recs)
        m_good = sum(
            int(r["good_qty"]) if r.get("good_qty") is not None else max(0, int(r.get("actual_qty") or 0) - int(r.get("rejected_qty") or 0))
            for r in m_recs
        )
        m_rejected = sum(int(r.get("rejected_qty") or 0) for r in m_recs)
        m_downtime = sum(int(r.get("downtime_minutes") or 0) for r in m_recs)

        active_dt = next((d for d in open_downtimes if str(d.get("machine_number", "")).upper() == m_num), None)
        status = "Breakdown" if active_dt else (m.get("status") or ("Running" if m_actual > 0 else "Idle"))

        if status == "Running":
            running_count += 1
        elif status == "Maintenance":
            maintenance_count += 1
        else:
            stopped_count += 1

        latest_rec = m_recs[-1] if m_recs else None
        hourly_actual = int(latest_rec.get("actual_qty") or 0) if latest_rec else 0
        hourly_target = int(latest_rec.get("target_qty") or 0) if latest_rec else 0
        total_pct = round((m_actual / m_target) * 100, 1) if m_target > 0 else 0.0
        hourly_pct = round((hourly_actual / hourly_target) * 100, 1) if hourly_target > 0 else 0.0

        machine_rows.append({
            "id": m.get("id"),
            "machine_number": m["machine_number"],
            "machine_type": m.get("machine_type", "NC"),
            "machine_group": m.get("machine_group") or m.get("machine_type", "NC"),
            "plant_id": m.get("plant_id", "Plant 1"),
            "tonnage": m.get("tonnage", 0),
            "configured_target": int(m.get("production_target") or 0),
            "target": m_target,
            "actual": m_actual,
            "good": m_good,
            "rejected": m_rejected,
            "downtime": m_downtime,
            "achievement_pct": total_pct,
            "total_output_pct": total_pct,
            "hourly_actual": hourly_actual,
            "hourly_target": hourly_target,
            "hourly_output_pct": hourly_pct,
            "status": status,
            "is_stopped": status in ("Breakdown", "Idle"),
            "active_downtime": active_dt,
            "operator": (latest_rec.get("operator_name") if latest_rec else "") or m.get("assigned_operator") or "",
            "tool_number": (latest_rec.get("tool_number") if latest_rec else "") or "",
            "version": m.get("version", 1),
            "updated_at": m.get("updated_at", ""),
        })

    return {
        "totals": {
            "actual": total_actual,
            "target": total_target,
            "good": total_good,
            "rejected": total_rejected,
            "downtime_minutes": total_downtime,
            "achievement_pct": achievement_pct,
            "quality_pct": quality_pct,
            "rejection_pct": rejection_pct,
            "machines_affected": len(affected_machines),
            "record_count": len(filtered_records),
        },
        "machine_counts": {
            "total": len(filtered_machines),
            "running": running_count,
            "maintenance": maintenance_count,
            "stopped": stopped_count,
        },
        "machines": machine_rows,
    }
