// BR-012 — External GPS Navigation.
//
// Single source of truth for building navigation deep links and web
// fallback URLs across Google Maps, Apple Maps, and Waze. Mirrors the
// rankingPolicy / inactivityPolicy / geographyPolicy pattern: every
// downstream module imports from here, never re-implements URL
// templates.
//
// Provider scheme strategy:
//   - Google: web URL only (no native scheme). Always works in a
//     browser; mobile browsers fall through to the Google Maps app
//     when installed.
//   - Apple Maps: `maps://?daddr=...` deep link when platform !== 'web',
//     web URL `https://maps.apple.com/?daddr=...` otherwise.
//   - Waze: `waze://?ll=...&navigate=yes` deep link when
//     platform !== 'web', web URL `https://waze.com/ul?...` otherwise.
//
// When the platform is `web` the deep-link URL would not open a native
// app, so we mark the provider with `fallbackReason: 'no_native_app'`
// — the client can choose to surface a different action or just open
// the URL in a new tab.

export const MAPS_PROVIDERS = Object.freeze(['google', 'apple', 'waze']);
export const PLATFORMS = Object.freeze(['ios', 'android', 'web']);

export const DEFAULT_PLATFORM = 'web';

export function parsePlatform(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (PLATFORMS.includes(value)) {
    return value;
  }
  return DEFAULT_PLATFORM;
}

function googleUrl({ origin, destination }) {
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destination}`;
}

function appleUrl({ destination, platform }) {
  if (platform !== 'web') {
    return `maps://?daddr=${destination}&dirflg=d`;
  }
  return `https://maps.apple.com/?daddr=${destination}&dirflg=d`;
}

function wazeUrl({ destination, platform }) {
  if (platform !== 'web') {
    return `waze://?ll=${destination}&navigate=yes`;
  }
  return `https://waze.com/ul?ll=${destination}&navigate=yes`;
}

/**
 * Build a structured set of navigation URLs for a given origin and
 * destination. The `destination` argument should be a `lat,lng` string.
 *
 * Returns an object keyed by provider name. Each provider entry has a
 * `url` string and a `fallbackReason` which is `null` when the URL
 * will open a native maps app, or `'no_native_app'` when the URL is
 * only a web fallback.
 */
export function buildMapsUrls({ origin = null, destination, platform = DEFAULT_PLATFORM } = {}) {
  if (!destination) {
    throw new Error('buildMapsUrls requires a destination string.');
  }
  const normalizedPlatform = parsePlatform(platform);
  const nativeUnavailable = normalizedPlatform === 'web';
  return {
    google: {
      url: googleUrl({ origin, destination }),
      fallbackReason: null,
    },
    apple: {
      url: appleUrl({ destination, platform: normalizedPlatform }),
      fallbackReason: nativeUnavailable ? 'no_native_app' : null,
    },
    waze: {
      url: wazeUrl({ destination, platform: normalizedPlatform }),
      fallbackReason: nativeUnavailable ? 'no_native_app' : null,
    },
  };
}

export const NAVIGATION_DESCRIPTION =
  'BR-012 External GPS Navigation: the restaurant detail endpoint ' +
  'returns deep links for Google Maps, Apple Maps, and Waze plus a ' +
  '`platform` hint (`ios` / `android` / `web`, default `web`). Each ' +
  'provider entry has a `fallbackReason: null` when the URL opens a ' +
  'native maps app, or `no_native_app` when the URL is only a web ' +
  'fallback (platform=web). The legacy `mapsUrl` field is preserved ' +
  'and is always the Google Maps web URL for backward compatibility.';