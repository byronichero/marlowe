"""OpenTelemetry setup for FastAPI instrumentation."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import settings

logger = logging.getLogger(__name__)


def init_otel(app: FastAPI) -> None:
    """Initialize OpenTelemetry tracing for the FastAPI app."""
    if not settings.otel_enabled:
        return
    try:
        resource = Resource.create({"service.name": settings.otel_service_name})
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(
            endpoint=settings.otel_exporter_otlp_endpoint,
            insecure=settings.otel_exporter_otlp_insecure,
        )
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        HTTPXClientInstrumentor().instrument()
        # Langchain instrumentation can fail due to opentelemetry-semantic-conventions-ai version mismatch
        try:
            from opentelemetry.instrumentation.langchain import LangchainInstrumentor

            LangchainInstrumentor().instrument()
        except ImportError as e:
            logger.warning("LangChain instrumentation skipped (version mismatch): %s", e)
    except Exception as exc:
        logger.warning("OpenTelemetry init failed: %s", exc)
