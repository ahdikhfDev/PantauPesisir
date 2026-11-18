"""PantauPesisir FastAPI application entry point."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.status import HTTP_500_INTERNAL_SERVER_ERROR

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.seed import ensure_schema, seed_if_empty
from app.services.simulator import simulator

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger("cews")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_schema()
    try:
        result = seed_if_empty()
        logger.info("Seed state: %s", result)
    except Exception:  # noqa: BLE001 - startup should not crash the API on seed issues
        logger.exception("Seeding failed; API will start with the existing database state")
    if settings.simulator_autostart:
        try:
            await simulator.start()
            logger.info("Automatic buoy simulator started")
        except Exception:  # noqa: BLE001
            logger.exception("Automatic simulator failed to start")
    yield
    await simulator.stop()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Coastal Early Warning System prototype API. Simulated buoy telemetry, verified "
        "Copernicus Sentinel-2 metadata, isolation-forest anomaly screening and a transparent "
        "prototype risk rubric. Not an official warning service."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "Idempotency-Key"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": _reason(exc.status_code), "detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "detail": "Request payload failed validation.",
            "issues": [
                {"location": ".".join(str(part) for part in error["loc"]), "message": error["msg"]}
                for error in exc.errors()
            ],
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "internal_server_error", "detail": "Unexpected server error. Check server logs."},
    )


@app.get("/", tags=["meta"], summary="Service metadata")
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "api": settings.api_v1_prefix,
        "docs": "/docs",
        "disclaimer": (
            "Prototype decision support for a student competition. Not an operational tsunami "
            "warning system and not a replacement for BMKG, BPBD or official authorities."
        ),
    }


app.include_router(api_router, prefix=settings.api_v1_prefix)


def _reason(status_code: int) -> str:
    mapping = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "unprocessable_entity",
        429: "rate_limited",
        503: "service_unavailable",
    }
    return mapping.get(status_code, "http_error")
