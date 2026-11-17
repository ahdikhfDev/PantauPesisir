"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.routers import (
    alerts,
    analytics,
    buoy,
    ingestion,
    satellite,
    simulator,
    system,
    zones,
)

api_router = APIRouter()
api_router.include_router(ingestion.router)
api_router.include_router(buoy.router)
api_router.include_router(simulator.router)
api_router.include_router(satellite.router)
api_router.include_router(analytics.router)
api_router.include_router(alerts.router)
api_router.include_router(system.router)
api_router.include_router(zones.router)
