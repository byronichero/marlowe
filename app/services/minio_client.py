"""MinIO / S3-compatible client for object storage."""

import io
from typing import BinaryIO

from minio import Minio

from app.core.config import settings


def get_minio_client() -> Minio:
    """Return a MinIO client from settings."""
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def ensure_bucket(client: Minio | None = None) -> None:
    """Ensure the configured bucket exists."""
    c = client or get_minio_client()
    if not c.bucket_exists(settings.minio_bucket):
        c.make_bucket(settings.minio_bucket)


def upload_file(
    object_name: str,
    data: BinaryIO | bytes,
    length: int | None = None,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload a file to MinIO; returns object key (path)."""
    client = get_minio_client()
    ensure_bucket(client)
    if isinstance(data, bytes):
        data = io.BytesIO(data)
        length = length or len(data.getvalue())
    elif length is None:
        data.seek(0, 2)
        length = data.tell()
        data.seek(0)
    client.put_object(settings.minio_bucket, object_name, data, length, content_type=content_type)
    return object_name


def get_presigned_url(object_name: str, expires_seconds: int = 3600) -> str:
    """Return a presigned URL for GET."""
    client = get_minio_client()
    return client.presigned_get_object(settings.minio_bucket, object_name, expires=expires_seconds)
