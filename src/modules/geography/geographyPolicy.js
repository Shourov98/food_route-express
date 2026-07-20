// BR-009 + BR-010: Geographic policy.
//
// Single source of truth for which cities are in the active service area
// (BR-010) and what radius the user's geolocation should operate in
// (BR-009). Mirrors the rankingPolicy / inactivityPolicy pattern: every
// downstream module imports from here, never re-declares the constants.
//
// MVP rules:
//   - Active cities default to ['Mexico City', 'Monterrey', 'Guadalajara',
//     'Dhaka'] (BR-010 + Bangladesh launch). Env-overridable via
//     ACTIVE_CITIES (JSON array OR comma-separated).
//   - Default proximity radius is 5 km (BR-009 "e.g. 5 km"). The user's
//     own `proximityDistanceKm` always takes precedence when finite.
//   - Secondary (widened) band is 3x the primary, with a floor of
//     SECONDARY_PROXIMITY_RADIUS_KM (15 km) so very small user radii
//     still produce a sensible fallback list.
//
// Out of scope (future BR):
//   - Zone / neighborhood fields.
//   - Per-city feature flags (e.g. enable receipts in Monterrey first).
//   - GeoHash / Firestore geoqueries for sub-millisecond proximity at scale.

export const MVP_ACTIVE_CITIES = Object.freeze([
  'Mexico City',
  'Monterrey',
  'Guadalajara',
  'Dhaka',
]);

export const DEFAULT_PROXIMITY_RADIUS_KM = 5;
export const SECONDARY_PROXIMITY_RADIUS_KM = 15;
export const SECONDARY_RADIUS_MULTIPLIER = 3;

function normalizeCity(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseActiveCities(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return [...MVP_ACTIVE_CITIES];
  }
  // JSON array first.
  if (String(raw).trim().startsWith('[')) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean);
      if (cleaned.length) return cleaned;
    }
    // JSON parse failed (or parsed to non-array); fall through to MVP.
    return [...MVP_ACTIVE_CITIES];
  }
  // Comma-separated fallback: "Mexico City, Monterrey, Guadalajara".
  const parts = String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [...MVP_ACTIVE_CITIES];
}

function parseRadiusKm(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function loadGeographyConfig(env = process.env) {
  return {
    activeCities: parseActiveCities(env?.ACTIVE_CITIES),
    defaultRadiusKm: parseRadiusKm(env?.DEFAULT_PROXIMITY_RADIUS_KM, DEFAULT_PROXIMITY_RADIUS_KM),
    secondaryRadiusKm: parseRadiusKm(env?.SECONDARY_PROXIMITY_RADIUS_KM, SECONDARY_PROXIMITY_RADIUS_KM),
  };
}

export function getActiveCityNames(config = loadGeographyConfig()) {
  return [...(config.activeCities ?? MVP_ACTIVE_CITIES)];
}

export function isActiveCity(city, config = loadGeographyConfig()) {
  if (!city) return false;
  const needle = normalizeCity(city);
  const haystack = getActiveCityNames(config);
  return haystack.some((entry) => normalizeCity(entry) === needle);
}

/**
 * Resolve the user's primary operating radius in km.
 *
 * Honours `user.proximityDistanceKm` when it is a finite positive number
 * (this is the user-configured radius and is the "main operating unit"
 * per BR-009). Falls back to `config.defaultRadiusKm` (5 km) when the
 * user has never set one.
 */
export function resolveRadiusKm(user, config = loadGeographyConfig()) {
  const userRadius = user?.proximityDistanceKm;
  if (Number.isFinite(userRadius) && userRadius > 0) {
    return userRadius;
  }
  return config.defaultRadiusKm ?? DEFAULT_PROXIMITY_RADIUS_KM;
}

/**
 * Resolve the secondary (widened) radius in km when the primary window
 * yields zero results. The user-configured radius takes precedence;
 * otherwise we widen to (userRadius * SECONDARY_RADIUS_MULTIPLIER) with
 * a floor of `config.secondaryRadiusKm` so small radii still produce a
 * sensible fallback band.
 */
export function resolveSecondaryRadiusKm(user, config = loadGeographyConfig()) {
  const primary = resolveRadiusKm(user, config);
  const widened = primary * SECONDARY_RADIUS_MULTIPLIER;
  const floor = config.secondaryRadiusKm ?? SECONDARY_PROXIMITY_RADIUS_KM;
  return Math.max(widened, floor);
}

export function outOfServiceMessage(config = loadGeographyConfig()) {
  const cities = getActiveCityNames(config);
  return `Food Route is currently available in ${cities.join(', ')}. ` +
    'Choose one of these cities manually to browse restaurants.';
}

export const GEOGRAPHY_DESCRIPTION =
  'BR-009 + BR-010 Geographic Policy: the user-configured proximity radius ' +
  '(default 5 km) is the main operating unit for restaurant browsing and ' +
  'proximity alerts. Active cities are MVP defaults (Mexico City, Monterrey, ' +
  'Guadalajara) but env-overridable. Restaurants outside the active city ' +
  'allowlist are hidden from end-user discovery; users in non-active cities ' +
  'or who pick a non-active city manually receive an out_of_service_area ' +
  'error.';