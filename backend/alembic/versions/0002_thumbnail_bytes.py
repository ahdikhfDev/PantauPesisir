"""Store satellite quicklook bytes in the database.

Revision ID: 0002_thumbnail_bytes
Revises: 0001_initial
Create Date: 2026-11-18

Serverless hosts lose the /tmp cache between instances, so the quicklook image
is persisted with the dataset row and served from the API.

Revision 0001 builds the schema from SQLAlchemy metadata, which already carries
this column for installations created after the model changed. The upgrade
therefore checks the live table before adding, so the same chain applies to both
an older database and a fresh one.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_thumbnail_bytes"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def _existing_columns() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns("satellite_datasets")}


def upgrade() -> None:
    present = _existing_columns()
    if "thumbnail_bytes" not in present:
        op.add_column("satellite_datasets", sa.Column("thumbnail_bytes", sa.LargeBinary(), nullable=True))
    if "thumbnail_media_type" not in present:
        op.add_column(
            "satellite_datasets", sa.Column("thumbnail_media_type", sa.String(length=32), nullable=True)
        )


def downgrade() -> None:
    present = _existing_columns()
    if "thumbnail_media_type" in present:
        op.drop_column("satellite_datasets", "thumbnail_media_type")
    if "thumbnail_bytes" in present:
        op.drop_column("satellite_datasets", "thumbnail_bytes")
