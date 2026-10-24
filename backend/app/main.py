"""Gridbricks Backend Main Application.

Exposes production-ready REST APIs for UK Wind Generation forecast accuracy evaluation,
temporal snapshot queries, and data health reporting.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    accuracy,
    data_health,
    decisions,
    evolution,
    exports,
    health,
    ingestion,
    overview,
)
from app.core.config import get_settings
from app.core.exceptions import GridbricksError
from app.core.logging import get_logger, setup_logging
from app.schemas.common import RFC7807Problem

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for application startup and shutdown."""
    setup_logging()
    settings = get_settings()
    logger.info(
        f"Starting {settings.APP_NAME} in '{settings.ENVIRONMENT}' environment "
        f"[Mode={settings.DECISION_DATE_MODE}, Timezone={settings.DECISION_TIMEZONE}, Cutoff={settings.DECISION_CUTOFF_LOCAL_TIME}]"
    )
    yield
    logger.info(f"Shutting down {settings.APP_NAME}")


def create_application() -> FastAPI:
    """FastAPI application factory."""
    settings = get_settings()

    app = FastAPI(
        title="Gridbricks Backend: UK Wind Forecast & Procurement Analytics",
        description=(
            "Gridbricks Full Stack SWE Assignment "
            "Evaluates national wind generation forecast accuracy vs actuals (Elexon FUELHH & WINDFOR), "
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # CORS configuration for future React frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # RFC 7807 Problem Details error handlers
    @app.exception_handler(GridbricksError)
    async def gridbricks_error_handler(request: Request, exc: GridbricksError):
        logger.warning(f"Domain error on {request.url.path}: {exc.message}")
        problem = exc.to_problem_details()
        problem["instance"] = request.url.path
        return JSONResponse(status_code=exc.status_code, content=problem)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        logger.info(f"Validation failure on {request.url.path}: {exc.errors()}")
        err_details = {
            f"loc_{i}": {"loc": err["loc"], "msg": err["msg"], "type": err["type"]}
            for i, err in enumerate(exc.errors())
        }
        problem = RFC7807Problem(
            type="urn:gridbricks:error:validation",
            title="Request Validation Error",
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The request parameters failed validation schema checks.",
            instance=request.url.path,
            invalid_params=err_details,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=problem.model_dump(),
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
        problem = RFC7807Problem(
            type="urn:gridbricks:error:internal",
            title="Internal Server Error",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected server error occurred. Please contact system operations.",
            instance=request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=problem.model_dump(),
        )

    # Root Info Route
    @app.get("/", tags=["Info"])
    def root_info():
        return {
            "name": settings.APP_NAME,
            "version": "0.1.0",
            "status": "operational",
            "environment": settings.ENVIRONMENT,
            "docs_url": "/docs",
            "health_url": "/health/ready",
            "mode": settings.DECISION_DATE_MODE,
        }

    # Mount Route Handlers
    app.include_router(health.router)
    app.include_router(overview.router)
    app.include_router(decisions.router)
    app.include_router(accuracy.router)
    app.include_router(evolution.router)
    app.include_router(data_health.router)
    app.include_router(ingestion.router)
    app.include_router(exports.router)

    return app


app = create_application()
