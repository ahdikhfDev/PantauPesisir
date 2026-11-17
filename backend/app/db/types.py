"""Dialect-aware geometry type: PostGIS on PostgreSQL, WKT text on SQLite.

Production deployments run PostgreSQL + PostGIS (POINT / MULTIPOLYGON, SRID 4326,
GiST indexes). The local demo uses SQLite so the vertical slice can run without
Docker; geometry is then stored as well-known text. Both paths hand the
application a Shapely geometry object.
"""

from __future__ import annotations

from typing import Any

from geoalchemy2 import Geometry as PostGISGeometry
from geoalchemy2.shape import from_shape, to_shape
from shapely import wkt as shapely_wkt
from shapely.geometry import shape as shapely_shape
from shapely.geometry.base import BaseGeometry
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator


def to_shapely(value: Any) -> BaseGeometry | None:
    if value is None:
        return None
    if isinstance(value, BaseGeometry):
        return value
    if isinstance(value, dict):
        return shapely_shape(value)
    if isinstance(value, (bytes, bytearray)):
        from shapely import wkb as shapely_wkb

        return shapely_wkb.loads(bytes(value))
    return shapely_wkt.loads(str(value))


def to_geojson(value: Any) -> dict[str, Any] | None:
    geometry = to_shapely(value)
    if geometry is None:
        return None
    import json

    return json.loads(json.dumps(geometry.__geo_interface__))


class Geometry(TypeDecorator):
    """Store a Shapely geometry in a PostGIS or SQLite column."""

    impl = Text
    cache_ok = True

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
        if value is None:
            return None
        if dialect.name == "postgresql":
            return to_shape(value)
        return shapely_wkt.loads(str(value))
