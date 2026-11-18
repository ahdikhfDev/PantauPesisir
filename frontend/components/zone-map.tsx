"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useMemo } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";

import { compass, fixed, formatShortUtc } from "@/lib/format";
import type { LatestResponse, SatelliteDataset, Zone } from "@/lib/types";

export function ZoneMap({
  zones,
  latest,
  datasets,
  layers,
}: {
  zones: Zone[];
  latest: LatestResponse | null;
  datasets: SatelliteDataset[];
  layers: { zones: boolean; buoys: boolean; footprints: boolean };
}) {
  const bounds = useMemo(() => {
    const centroids = zones
      .map((zone) => zone.centroid)
      .filter((centroid): centroid is { latitude: number; longitude: number } => Boolean(centroid))
      .map((centroid) => [centroid.latitude, centroid.longitude] as [number, number]);
    const fallback: Array<[number, number]> = [
      [-6.1, 106.85],
      [-6.94, 110.42],
      [-3.22, 117.48],
    ];
    const points = centroids.length ? centroids : fallback;
    return L.latLngBounds(points).pad(0.7);
  }, [zones]);

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
      attributionControl
      className="z-0"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> kontributor · hanya peta dasar'
      />

      {layers.zones
        ? zones.map((zone) => (
            <GeoJSON
              key={`zone-${zone.id}`}
              data={zone.boundary as never}
              style={{
                color: "#d93a2b",
                weight: 1.4,
                dashArray: "6 4",
                fillColor: "#d93a2b",
                fillOpacity: 0.04,
              }}
            >
              <Popup>
                <div className="text-[12px]">
                  <p className="font-semibold">{zone.zone_name}</p>
                  <p className="font-mono text-[10px] text-muted">{zone.zone_code}</p>
                  <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-muted">{zone.boundary_note}</p>
                </div>
              </Popup>
            </GeoJSON>
          ))
        : null}

      {layers.buoys
        ? zones.flatMap((zone) =>
            zone.buoys
              .filter((buoy) => buoy.latitude !== null && buoy.longitude !== null)
              .map((buoy) => {
                const observation = latest?.items.find((item) => item.buoy_code === buoy.buoy_code);
                return (
                  <CircleMarker
                    key={buoy.id}
                    center={[buoy.latitude as number, buoy.longitude as number]}
                    radius={8}
                    pathOptions={{
                      color: "#0c2c31",
                      weight: 2,
                      fillColor: "#d93a2b",
                      fillOpacity: 0.95,
                    }}
                  >
                    <Popup>
                      <div className="text-[12px]">
                        <p className="font-semibold">{buoy.buoy_code}</p>
                        <p className="text-[10px] text-muted">{zone.zone_name} · pemantauan</p>
                        {observation ? (
                          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                            <dt className="text-muted">Gelombang</dt>
                            <dd className="font-mono">{fixed(observation.parameters.wave_height_m, 2)} m</dd>
                            <dt className="text-muted">Periode</dt>
                            <dd className="font-mono">{fixed(observation.parameters.wave_period_s, 1)} s</dd>
                            <dt className="text-muted">Angin</dt>
                            <dd className="font-mono">{fixed(observation.parameters.wind_speed_mps, 1)} m/s</dd>
                            <dt className="text-muted">Tekanan</dt>
                            <dd className="font-mono">{fixed(observation.parameters.air_pressure_hpa, 1)} hPa</dd>
                            <dt className="text-muted">Swell dari</dt>
                            <dd className="font-mono">
                              {compass(observation.parameters.wave_direction_deg)}{" "}
                              {fixed(observation.parameters.wave_direction_deg, 0)}°
                            </dd>
                          </dl>
                        ) : null}
                        {observation ? (
                          <p className="mt-1.5 text-[9px] text-muted">{formatShortUtc(observation.observed_at)} UTC</p>
                        ) : null}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              }),
          )
        : null}

      {layers.footprints
        ? datasets
            .filter((dataset) => dataset.footprint && (dataset.footprint as { coordinates?: unknown }).coordinates)
            .map((dataset) => (
              <GeoJSON
                key={`footprint-${dataset.id}`}
                data={dataset.footprint as never}
                style={{
                  color: "#123f46",
                  weight: 1,
                  fillColor: "#123f46",
                  fillOpacity: 0.09,
                }}
              >
                <Popup>
                  <div className="text-[11px]">
                    <p className="font-semibold">{dataset.collection}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{dataset.product_id}</p>
                    <p className="mt-1 text-[10px]">
                      Diakuisisi <strong>{formatShortUtc(dataset.acquired_at)} UTC</strong>
                    </p>
                    <p className="text-[10px]">Awan {fixed(dataset.cloud_cover_percent, 1)}%</p>
                    <p className="mt-1 text-[9px] leading-snug text-muted">
                      Akuisisi Copernicus historis. Hanya sebagai konteks optik.
                    </p>
                  </div>
                </Popup>
              </GeoJSON>
            ))
        : null}
    </MapContainer>
  );
}
