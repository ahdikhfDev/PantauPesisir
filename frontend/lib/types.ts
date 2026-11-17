export type SourceType = "simulated" | "observed" | "historical";

export interface BuoyParameters {
  wave_height_m: number;
  wave_period_s: number;
  wave_direction_deg: number;
  wind_speed_mps: number;
  wind_direction_deg: number;
  sea_temperature_c: number;
  air_pressure_hpa: number;
}

export interface BuoyDevice {
  id: string;
  buoy_code: string;
  zone_id: string;
  zone_code: string | null;
  zone_name: string | null;
  latitude: number | null;
  longitude: number | null;
  device_status: string;
  source_type: string;
}

export interface Zone {
  id: string;
  zone_code: string;
  zone_name: string;
  description: string | null;
  boundary: { type: string; coordinates: unknown };
  boundary_note: string;
  centroid: { latitude: number; longitude: number } | null;
  buoys: BuoyDevice[];
  created_at: string;
}

export interface Observation {
  id: string;
  buoy_code: string;
  zone_code: string | null;
  simulation_id: string | null;
  observed_at: string;
  received_at: string;
  processed_at: string | null;
  parameters: BuoyParameters;
  latitude: number;
  longitude: number;
  source_type: SourceType;
  scenario: string;
  generator_version: string;
  validation_status: string;
  validation_errors: Array<{ field: string; code: string; message: string }> | null;
  data_age_seconds: number;
  idempotency_key: string;
}

export interface LatestResponse {
  items: Observation[];
  stale: boolean;
  stale_after_seconds: number;
}

export interface HistoryResponse {
  items: Observation[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
}

export interface ContributingFactor {
  feature: string;
  label: string;
  value: number;
  unit: string;
  baseline_mean: number;
  deviation_sigma: number;
  direction: string;
}

export interface Prediction {
  id: string;
  zone_id: string;
  zone_code: string | null;
  zone_name: string | null;
  model_version: string;
  model_name: string | null;
  algorithm: string | null;
  analysis_started_at: string;
  analysis_ended_at: string;
  observation_window_start: string | null;
  observation_window_end: string | null;
  windows_evaluated: number;
  input_observation_count: number;
  input_observation_ids: string[];
  matched_satellite_dataset_ids: string[];
  anomaly_detected: boolean;
  anomaly_score: number;
  anomaly_threshold: number;
  risk_score: number | null;
  risk_level: "low" | "moderate" | "high" | null;
  risk_method: string | null;
  contributing_factors: ContributingFactor[];
  explanation: string;
  recommendation: string;
  caveats: string[];
  data_quality_summary: Record<string, unknown> | null;
  is_simulated: boolean;
  created_at: string;
  alert_id: string | null;
}

export interface Alert {
  id: string;
  prediction_id: string | null;
  zone_id: string;
  zone_code: string | null;
  zone_name: string | null;
  severity: "info" | "moderate" | "high";
  title: string;
  description: string;
  status: "open" | "acknowledged" | "resolved";
  source: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
}

export interface AlertList {
  items: Alert[];
  total: number;
  counts_by_status: Record<string, number>;
  counts_by_severity: Record<string, number>;
}

export interface SatelliteDataset {
  id: string;
  zone_id: string | null;
  provider: string;
  collection: string;
  product_id: string;
  acquired_at: string;
  downloaded_at: string | null;
  processed_at: string | null;
  footprint: { type: string; coordinates: unknown };
  asset_uri: string | null;
  thumbnail_uri: string | null;
  thumbnail_url: string | null;
  cloud_cover_percent: number | null;
  resolution_m: number | null;
  crs: string | null;
  license: string | null;
  attribution: string | null;
  processing_status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface SatelliteJob {
  id: string;
  provider: string;
  zone_id: string | null;
  query_parameters: Record<string, unknown>;
  status: string;
  datasets_found: number;
  datasets_stored: number;
  used_cache: boolean;
  warnings: string[] | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface SimulationJob {
  id: string;
  scenario: string;
  mode: string;
  status: string;
  zone_code: string | null;
  random_seed: number;
  generator_version: string;
  interval_seconds: number;
  observations_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  notes: string | null;
}

export interface DataSourceStatus {
  source_name: string;
  source_type: string;
  status: string;
  last_observed_at: string | null;
  last_received_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  age_seconds: number | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

export interface DataSourcesResponse {
  items: DataSourceStatus[];
  generated_at: string;
}

export interface SimulatorStatus {
  running: boolean;
  scenario: string;
  interval_seconds: number;
  zone_code: string;
  simulation_id: string | null;
  started_at: string | null;
  last_tick_at: string | null;
  observations_generated: number;
  last_error: string | null;
  generator_version: string;
  source_type: string;
}

export interface SystemHealth {
  status: string;
  version: string;
  environment: string;
  demo_mode: boolean;
  database: { dialect?: string; ok: boolean; error?: string };
  model: {
    available: boolean;
    version?: string;
    trained_at?: string;
    training_dataset?: string;
    calibration?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
    reason?: string;
  };
  simulator: SimulatorStatus;
  satellite_provider: Record<string, unknown>;
  counts: Record<string, number>;
  generated_at: string;
}

export interface Overview {
  generated_at: string;
  zones: Zone[];
  latest_observations: Observation[];
  latest_prediction: Prediction | null;
  alert_counts: Record<string, number>;
  recent_alerts: Alert[];
  data_freshness: {
    newest_observation_age_seconds: number | null;
    stale: boolean;
    stale_after_seconds: number;
    sources: DataSourceStatus[];
  };
  simulator: SimulatorStatus;
  satellite: Record<string, unknown>;
  provenance_notice: string;
}

export interface ModelInfo {
  model_name: string;
  model_version: string;
  algorithm: string;
  training_dataset: string;
  training_period: string;
  model_uri: string;
  metrics: Record<string, unknown>;
  feature_schema: Array<{ name: string; position: number }>;
  limitations: string[];
}

export interface SatelliteProviderInfo {
  provider: string;
  name: string;
  access: string;
  dataset: string;
  license: string;
  note: string;
  docs_url: string;
  api_base_url: string;
  default_collection: string;
  source_status: string;
  last_error: string | null;
  summary: Record<string, unknown>;
}
