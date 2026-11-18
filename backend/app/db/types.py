"""Dialect-aware geometry type: PostGIS on PostgreSQL, WKT text on SQLite.

Production deployments run PostgreSQL + PostGIS (POINT / MULTIPOLYGON, SRID 4326,
GiST indexes). The local demo uses SQLite so the vertical slice can run without
Docker; geometry is then stored as well-known text. Both paths hand the
application a Shapely geometry object.

The concrete class is chosen from ``DATABASE_URL`` at import time because
PostGIS rewrites geometry columns through ``ST_AsEWKB(col, type_=self)`` in
``column_expression``: the expression carries the PostGIS type itself, so a
``TypeDecorator`` wrapper would be bypassed and hand back ``WKBElement``
objects instead of Shapely geometries.
"""

from __future__ import annotations

from typing import Any

from geoalchemy2 import Geometry as PostGISGeometry
from geoalchemy2.elements import WKBElement
from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import from_shape
from geoalchemy2.shape import to_shape
from shapely import wkb as shapely_wkb
from shapely import wkt as shapely_wkt
from shapely.geometry import shape as shapely_shape
from shapely.geometry.base import BaseGeometry
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.config import settings


def _looks_like_hex_wkb(text: str) -> bool:
    if len(text) < 16 or len(text) % 2:
        return False
    return all(character in "0123456789abcdefABCDEF" for character in text)


def to_shapely(value: Any) -> BaseGeometry | None:
    if value is None:
        return None
    if isinstance(value, BaseGeometry):
        return value
    if isinstance(value, (WKBElement, WKTElement)):
        return to_shape(value)
    if isinstance(value, dict):
        return shapely_shape(value)
    if isinstance(value, (bytes, bytearray)):
        return shapely_wkb.loads(bytes(value))
    text = str(value).strip()
    if _looks_like_hex_wkb(text):
        return shapely_wkb.loads(text, hex=True)
    return shapely_wkt.loads(text)


def to_geojson(value: Any) -> dict[str, Any] | None:
    geometry = to_shapely(value)
    if geometry is None:
        return None
    import json

    return json.loads(json.dumps(geometry.__geo_interface__))


class SQLiteGeometry(TypeDecorator):
    """Store a Shapely geometry as WKT text (SQLite demo database)."""

    impl = Text
    cache_ok = True

    # GeoAlchemy2 0.15 reads these attributes directly when it hooks CREATE TABLE.
    # Without them the lookup falls through to the Text impl and raises AttributeError.
    # Spatial GiST indexes are created explicitly by the Alembic migration instead
    # of relying on GeoAlchemy2's automatic index management.
    use_typmod = True
    spatial_index = False
    use_N_D_index = False

    def __init__(self, geometry_type: str = "POINT", srid: int = 4326) -> None:
        self.geometry_type = geometry_type.upper()
        self.srid = srid
        super().__init__()

    def load_dialect_impl(self, dialect):  # type: ignore[no-untyped-def]
        if dialect.name == "postgresql":
            return dialect.type_descriptor(
                PostGISGeometry(geometry_type=self.geometry_type, srid=self.srid)
            )
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect):  # type: ignore[no-untyped-def]
        geometry = to_shapely(value)
        if geometry is None:
            return None
        if dialect.name == "postgresql":
            return from_shape(geometry, srid=self.srid)
        return geometry.wkt

    def process_result_value(self, value: Any, dialect):  # type: ignore[no-untyped-def]
        return to_shapely(value)


class PostGISShapelyGeometry(PostGISGeometry):
    """PostGIS geometry column that reads and writes Shapely geometry objects."""

    cache_ok = True

    def __init__(self, geometry_type: str = "POINT", srid: int = 4326) -> None:
        # spatial_index=False: the Alembic migration owns the GiST indexes.
        super().__init__(geometry_type=geometry_type, srid=srid, spatial_index=False)

    def bind_processor(self, dialect):  # type: ignore[no-untyped-def]
        process_element = super().bind_processor(dialect)

        def process(value: Any) -> Any:
            if value is None or isinstance(value, (WKBElement, WKTElement)):
                return process_element(value)
            geometry = to_shapely(value)
            return process_element(from_shape(geometry, srid=self.srid))

        return process

    def result_processor(self, dialect, coltype):  # type: ignore[no-untyped-def]
        process_element = super().result_processor(dialect, coltype)

        def process(value: Any) -> Any:
            return to_shape(process_element(value))

        return process


Geometry = (
    PostGISShapelyGeometry
    if settings.database_url.startswith("postgresql")
    else SQLiteGeometry
)
