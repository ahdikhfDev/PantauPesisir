"""Coastal zone endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.zone import BuoyDevice, CoastalZone
from app.schemas.system import ZoneOut
from app.services.serializers import zone_out

router = APIRouter(prefix="/coastal", tags=["coastal zones"])


@router.get("/zones", response_model=list[ZoneOut], summary="List coastal monitoring zones")
def list_zones(db: Session = Depends(get_db)) -> list[ZoneOut]:
    zones = list(db.scalars(select(CoastalZone).order_by(CoastalZone.zone_name)))
    result: list[ZoneOut] = []
    for zone in zones:
        buoys = list(db.scalars(select(BuoyDevice).where(BuoyDevice.zone_id == zone.id)))
        result.append(zone_out(zone, buoys))
    return result


@router.get("/zones/{zone_code}", response_model=ZoneOut, summary="Zone detail with devices")
def get_zone(zone_code: str, db: Session = Depends(get_db)) -> ZoneOut:
    zone = db.scalar(select(CoastalZone).where(CoastalZone.zone_code == zone_code.upper()))
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    buoys = list(db.scalars(select(BuoyDevice).where(BuoyDevice.zone_id == zone.id)))
    return zone_out(zone, buoys)
