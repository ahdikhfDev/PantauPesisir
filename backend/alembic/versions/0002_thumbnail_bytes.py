"""Store satellite quicklook bytes in the database.

Revision ID: 0002_thumbnail_bytes
Revises: 0001_initial
Create Date: 2026-11-18

Serverless hosts lose the /tmp cache between instances, so the quicklook image
is persisted with the dataset row and served from the API.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_thumbnail_bytes"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("satellite_datasets", sa.Column("thumbnail_bytes", sa.LargeBinary(), nullable=True))
    op.add_column(
        "satellite_datasets", sa.Column("thumbnail_media_type", sa.String(length=32), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("satellite_datasets", "thumbnail_media_type")
    op.drop_column("satellite_datasets", "thumbnail_bytes")
