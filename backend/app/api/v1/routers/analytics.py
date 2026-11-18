"""AI analysis endpoints (risk intelligence)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_api_key
from app.db.session import get_db
from app.ml.inference import InsufficientDataError, ModelUnavailableError
from app.models.alert import Alert
from app.models.analytics import AIPrediction, MLModel
from app.models.zone import CoastalZone
from app.schemas.analytics import AnalyticsRunIn, AnalyticsRunResponse, PredictionOut
from app.services.analytics import ZoneNotFoundError, resolve_zone, run_analysis
from app.services.serializers import prediction_out

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _serialise(db: Session, prediction: AIPrediction) -> PredictionOut:
    zone = db.get(CoastalZone, prediction.zone_id)
    model = db.get(MLModel, prediction.model_id) if prediction.model_id else None
    alert = db.scalar(select(Alert).where(Alert.prediction_id == prediction.id))
    return prediction_out(
        prediction,
        zone=zone,
        model=model,
        alert_id=str(alert.id) if alert else None,
        input_observation_count=len(prediction.input_observation_ids or []),
    )


@router.post(
    "/run",
    response_model=AnalyticsRunResponse,
    dependencies=[Depends(require_api_key)],
    summary="Run anomaly detection + risk rubric for a zone",
    responses={503: {"description": "Model artifact unavailable"}, 422: {"description": "Insufficient data"}},
)
def run(payload: AnalyticsRunIn, db: Session = Depends(get_db)) -> AnalyticsRunResponse:
    try:
        zone = resolve_zone(db, payload.zone_id, payload.zone_code)
        prediction, alert, _context = run_analysis(
            db,
            zone=zone,
            window_minutes=payload.window_minutes,
            model_version=payload.model_version,
            create_alert=payload.create_alert,
        )
    except ZoneNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except InsufficientDataError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    result = _serialise(db, prediction)
    if alert is not None and result.alert_id is None:
        result.alert_id = alert.id
    return AnalyticsRunResponse(prediction=result)


@router.get("/latest", response_model=PredictionOut, summary="Latest analysis result")
def latest(
    zone_code: str | None = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
) -> PredictionOut:
    stmt = select(AIPrediction).order_by(AIPrediction.created_at.desc()).limit(1)
    if zone_code:
        stmt = (
            select(AIPrediction)
            .join(CoastalZone, AIPrediction.zone_id == CoastalZone.id)
            .where(CoastalZone.zone_code == zone_code.upper())
            .order_by(AIPrediction.created_at.desc())
            .limit(1)
        )
    prediction = db.scalar(stmt)
    if prediction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis has been run yet. Trigger one from the AI Risk page.",
        )
    return _serialise(db, prediction)


@router.get("/history", response_model=list[PredictionOut], summary="Recent analyses")
def history(
    zone_code: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[PredictionOut]:
    stmt = select(AIPrediction).order_by(AIPrediction.created_at.desc()).limit(limit)
    if zone_code:
        stmt = (
            select(AIPrediction)
            .join(CoastalZone, AIPrediction.zone_id == CoastalZone.id)
            .where(CoastalZone.zone_code == zone_code.upper())
            .order_by(AIPrediction.created_at.desc())
            .limit(limit)
        )
    return [_serialise(db, row) for row in db.scalars(stmt)]


@router.get("/model-info", summary="Model card metrics and provenance")
def model_info(db: Session = Depends(get_db)) -> dict:
    model = db.scalar(
        select(MLModel).where(MLModel.is_active.is_(True)).order_by(MLModel.created_at.desc()).limit(1)
    )
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No model registered. Train the model and run the seed script.",
        )
    return {
        "model_name": model.model_name,
        "model_version": model.model_version,
        "algorithm": model.algorithm,
        "training_dataset": model.training_dataset,
        "training_period": model.training_period,
        "model_uri": model.model_uri,
        "metrics": model.metrics,
        "feature_schema": model.feature_schema,
        "limitations": [
            "Penyaringan anomali tanpa pengawasan terhadap baseline model.",
            "Dilatih pada stasiun lepas pantai NOAA NDBC, diterapkan pada telemetri buoy pesisir Indonesia.",
            "Skor anomali mengukur penyimpangan relatif, bukan probabilitas kejadian.",
            "Tingkat risiko berasal dari rubrik transparan yang dapat direproduksi.",
        ],
    }


@router.get("/{analysis_id}", response_model=PredictionOut, summary="Analysis detail")
def detail(analysis_id: uuid.UUID, db: Session = Depends(get_db)) -> PredictionOut:
    prediction = db.get(AIPrediction, analysis_id)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return _serialise(db, prediction)
