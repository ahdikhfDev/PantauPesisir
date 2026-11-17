"""Privileged buoy ingestion endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import limit_ingestion, require_api_key
from app.db.session import get_db
from app.models.observation import BuoyObservation
from app.schemas.buoy import BuoyIngestionResponse, BuoyObservationIn
from app.services.ingestion import UnknownBuoyError, default_idempotency_key, ingest_observation
from app.services.serializers import observation_out

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post(
    "/buoy",
    response_model=BuoyIngestionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key), Depends(limit_ingestion)],
    summary="Ingest one buoy observation",
    responses={
        200: {"description": "Idempotent replay of an already stored observation"},
        404: {"description": "Buoy is not registered"},
        429: {"description": "Ingestion rate limit exceeded"},
    },
)
def ingest_buoy(payload: BuoyObservationIn, response: Response, db: Session = Depends(get_db)) -> BuoyIngestionResponse:
    try:
        outcome = ingest_observation(db, payload)
    except UnknownBuoyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except IntegrityError:
        db.rollback()
        key = payload.idempotency_key or default_idempotency_key(payload)
        existing = db.scalar(select(BuoyObservation).where(BuoyObservation.idempotency_key == key))
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Observation conflicts with an existing record for this buoy and timestamp.",
            )
        outcome = None  # type: ignore[assignment]
        return BuoyIngestionResponse(
            accepted=False,
            duplicate=True,
            validation_status=existing.validation_status,
            observation=None,
            errors=[],
        )

    assert outcome is not None
    if outcome.duplicate:
        response.status_code = status.HTTP_200_OK
    observation = None
    if outcome.observation is not None and outcome.buoy is not None:
        observation = observation_out(outcome.observation, outcome.buoy, outcome.zone)
    return BuoyIngestionResponse(
        accepted=outcome.validation_status == "valid" and not outcome.duplicate,
        duplicate=outcome.duplicate,
        validation_status=outcome.validation_status,
        observation=observation,
        errors=outcome.errors,
    )
