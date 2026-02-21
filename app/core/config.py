"""Environment-based configuration. All settings loaded from env (e.g. Docker Compose)."""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "change-me-in-production"
    debug: bool = False

    # CORS
    cors_origins: List[str] = ["http://localhost:5011", "http://localhost:5002", "http://localhost:4006", "http://localhost:3000", "http://127.0.0.1:5011"]

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://marlowe:marlowe@localhost:5432/marlowe"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "marlowe_documents"

    # Neo4j
    neo4j_uri: str = "neo4j://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # Ollama (on host)
    ollama_host: str = "http://host.docker.internal:11434"
    ollama_model: str = "qwen3:latest"
    ollama_fallback_model: str = "granite3.2:latest"  # used if requested model returns 404 (not pulled)
    ollama_api_timeout: int = 600  # seconds; long prompts/RAG can be slow

    # MinIO / S3-compatible
    minio_endpoint: str = "host.docker.internal:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket: str = "marlowe"

    # OpenTelemetry (local observability)
    otel_enabled: bool = True
    otel_service_name: str = "marlowe-api"
    otel_exporter_otlp_endpoint: str = "http://otel-collector:4317"
    otel_exporter_otlp_insecure: bool = True

    # Optional: path to credentials file (overrides env if present)
    credentials_file: str | None = None

    # Docs ingestion: path to folder to ingest into Qdrant (relative to project root or absolute)
    docs_path: str = "docs"
    # Embedding model and dimension (nomic-embed-text = 768)
    embedding_model: str = "nomic-embed-text"
    embedding_dimension: int = 768


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
