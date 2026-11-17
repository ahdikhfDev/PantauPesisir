# Demo script (3–5 minutes)

Target length: **4:00**. Record unlisted on YouTube. Voice-over + screen capture of the deployed
site. Keep every claim inside the app's own labels: simulated telemetry, historical satellite
records, prototype decision support.

## Pre-flight checklist

- [ ] Backend healthy: `/api/v1/system/health` → `status: ok`, model available.
- [ ] Simulator running (`SIMULATOR_AUTOSTART=true`, scope `ALL`) so zone cards are fresh.
- [ ] Satellite catalogue populated (run one sync before recording).
- [ ] One analysis exists so the AI page is not empty.
- [ ] Browser zoom 100%, 1440×900, dark-mode off.
- [ ] Demo key `cews-demo-2026` already stored in the tab, or ready to paste.
- [ ] Close unrelated tabs/notifications.

## 0:00–0:25 — Team and problem

**Screen:** Overview dashboard (sidebar + KPI row).

> "We are [team name] from [school]. Coastal communities in Indonesia make daily decisions on
> incomplete information: a fisher checks the sky, not a data feed. Official warnings exist, but the
> gap between raw observations and an understandable, traceable signal is real. CEWS is our
> prototype for closing that gap — honestly."

Point at the header chips (**Simulated feed**, **Prototype**) and the metric cards.

## 0:25–0:55 — Architecture in one breath

**Screen:** `/sources` (open it from the sidebar).

> "Three layers. Synthetic buoy telemetry enters a FastAPI backend, is validated and stored in
> PostgreSQL/PostGIS. A real Copernicus Sentinel-2 STAC search adds acquisition metadata and cached
> quicklooks. An Isolation Forest, trained on 41,104 real NOAA NDBC observations, scores how unusual
> the last window is, and a separate transparent rubric grades absolute severity. The dashboard never
> mixes those sources."

## 0:55–1:35 — Ocean monitoring

**Screen:** `/ocean`.

1. Point at the freshness strip: last observed, received, age, within freshness window.
2. Hover the wave metric: 1.0 m, period, wind, pressure, sea temperature — **units on every value**.
3. Scroll to the charts: wave height + wind, then pressure + period. Mention UTC labels.
4. Open the provenance panel: observed, received and processed times are separate; source is
   `simulated`; simulation ID present.
5. Trigger the simulator: scenario **Extreme**, 12 observations, 300 s. Click **Generate burst**.
6. Show the job completing and the chart spike. Say clearly:

> "Every one of these new points is synthetic, tagged simulated, and the burst replaced earlier
> synthetic readings in its replay window so the timeline stays coherent."

## 1:35–2:05 — Satellite map

**Screen:** `/satellite`.

1. Show provider banner: "Copernicus Data Space Ecosystem — Sentinel-2 L2A", licence, status.
2. Map: toggle zone polygons, buoy markers, footprints. Click a red buoy popup (latest simulated
   values). Click a footprint popup (product id, acquired time, cloud cover).
3. Point at the attribution line and the caveat: **optical imagery is not wave height**.
4. Explain the sync form: "This calls the real STAC API; we store metadata and one quicklook per
   acquisition. Full rasters need a Copernicus account, so we do not pretend to have them."
5. If bandwidth allows, click **Query Copernicus STAC** and show `found/stored`. If not, show the
   existing catalogue cards.

## 2:05–2:55 — AI demo

**Screen:** `/ai`.

1. Model card: version `cews-iforest-v1`, Isolation Forest, training data NDBC stations 51002/41010,
   calibration 10% on normal windows.
2. Run analysis: zone Jakarta Bay, window 60 minutes, alert enabled. Click **Run AI analysis**.
3. Read the result:
   - risk level and rubric score;
   - anomaly index versus the 0.50 threshold (explain: anomaly ≠ hazard);
   - top contributing factors with values/units and σ;
   - data quality and satellite matches.
4. Read one caveat aloud: "The model was trained on offshore US buoys and scores simulated
   Indonesian telemetry; domain shift is expected."
5. Open the recommendation: "Prototype advisory… confirm with BMKG/BPBD."

## 2:55–3:30 — Alert workflow

**Screen:** `/alerts`.

1. Show the alert created by the analysis (severity, zone, timestamps, status).
2. Click **Read full note**, then **Acknowledge**; show the actor and UTC timestamp.
3. Click **Resolve**; show the resolved timestamp. Mention the API rejects reopening (409) to keep an
   audit trail.
4. Mention the dedupe window: repeated runs within 30 minutes do not spam duplicate alerts.

## 3:30–4:00 — Impact and close

**Screen:** `/sources` or back to Overview.

> "For coastal economic resilience, this is the value: fishers, small businesses and port operators
> can see a verified condition summary, its age, and whether it is unusual — before committing a
> trip. What we do not claim is just as important: no tsunami detection, no wave heights from
> satellite pixels, no official warnings, no market predictions. The code, data provenance, model
> card and tests are public. Thank you."

## Backup plans

| Problem during recording | Fix |
| --- | --- |
| Copernicus unreachable | Show cached datasets + provider `unavailable` state; say that this is the designed fallback |
| Analysis returns 422 | Generate a scenario first, or widen the window |
| Model returns 503 | Restart backend; artifact path is in `/system/health` |
| Charts empty | Check the zone has rows in the chosen window; switch to 24 h |
| Demo key rejected | Paste `cews-demo-2026` in the operator key field |
