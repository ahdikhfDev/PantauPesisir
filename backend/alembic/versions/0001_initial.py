"""Initial CEWS schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-18

This bootstrapping revision creates every table from the SQLAlchemy metadata so
the same migration works on PostgreSQL/PostGIS and on the SQLite demo database.
Subsequent schema changes should be generated with ``alembic revision --autogenerate``.
"""

from __future__ import annotations

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    from app.db.base import Base
    import app.models  # noqa: F401 - ensure models are imported

    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX IF NOT EXISTS gix_coastal_zones_boundary ON coastal_zones USING GIST (boundary)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS gix_buoy_devices_location ON buoy_devices USING GIST (location)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS gix_buoy_observations_location ON buoy_observations USING GIST (location)"
        )
        op.execute(
            "CREATE INDEX IF NOT EXISTS gix_satellite_datasets_footprint ON satellite_datasets USING GIST (footprint)"
        )


def downgrade() -> None:
    from app.db.base import Base
    import app.models  # noqa: F401

    Base.metadata.drop_all(bind=op.get_bind())
