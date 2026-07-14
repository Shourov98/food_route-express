import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PROXIMITY_RADIUS_KM,
  GEOGRAPHY_DESCRIPTION,
  MVP_ACTIVE_CITIES,
  SECONDARY_PROXIMITY_RADIUS_KM,
  getActiveCityNames,
  isActiveCity,
  loadGeographyConfig,
  outOfServiceMessage,
  resolveRadiusKm,
  resolveSecondaryRadiusKm,
} from '../src/modules/geography/geographyPolicy.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test('MVP_ACTIVE_CITIES contains exactly Mexico City, Monterrey, Guadalajara', () => {
  assert.deepEqual([...MVP_ACTIVE_CITIES], ['Mexico City', 'Monterrey', 'Guadalajara']);
});

test('Default radius constants', () => {
  assert.equal(DEFAULT_PROXIMITY_RADIUS_KM, 5);
  assert.equal(SECONDARY_PROXIMITY_RADIUS_KM, 15);
});

// ---------------------------------------------------------------------------
// isActiveCity
// ---------------------------------------------------------------------------

test('isActiveCity matches active cities (case-insensitive)', () => {
  assert.equal(isActiveCity('Mexico City'), true);
  assert.equal(isActiveCity('mexico city'), true);
  assert.equal(isActiveCity('MONTERREY'), true);
  assert.equal(isActiveCity('Guadalajara'), true);
});

test('isActiveCity rejects unknown cities', () => {
  assert.equal(isActiveCity('Dhaka'), false);
  assert.equal(isActiveCity('Karachi'), false);
  assert.equal(isActiveCity(''), false);
  assert.equal(isActiveCity(null), false);
  assert.equal(isActiveCity(undefined), false);
  assert.equal(isActiveCity('Mexico'), false, 'partial-match must fail');
});

// ---------------------------------------------------------------------------
// getActiveCityNames
// ---------------------------------------------------------------------------

test('getActiveCityNames returns a copy of the allowlist', () => {
  const cities = getActiveCityNames();
  assert.equal(cities.length, 3);
  assert.equal(cities[0], 'Mexico City');
  cities[0] = 'Tampered';
  assert.equal(getActiveCityNames()[0], 'Mexico City',
    'returned array should be a copy, not a reference');
});

// ---------------------------------------------------------------------------
// loadGeographyConfig
// ---------------------------------------------------------------------------

test('loadGeographyConfig uses MVP defaults when env is empty', () => {
  const cfg = loadGeographyConfig({});
  assert.deepEqual(cfg.activeCities, ['Mexico City', 'Monterrey', 'Guadalajara']);
  assert.equal(cfg.defaultRadiusKm, 5);
  assert.equal(cfg.secondaryRadiusKm, 15);
});

test('loadGeographyConfig reads ACTIVE_CITIES as JSON array', () => {
  const cfg = loadGeographyConfig({ ACTIVE_CITIES: '["Lisbon","Porto"]' });
  assert.deepEqual(cfg.activeCities, ['Lisbon', 'Porto']);
});

test('loadGeographyConfig reads ACTIVE_CITIES as comma-separated string', () => {
  const cfg = loadGeographyConfig({ ACTIVE_CITIES: 'Lisbon, Porto, Braga' });
  assert.deepEqual(cfg.activeCities, ['Lisbon', 'Porto', 'Braga']);
});

test('loadGeographyConfig reads DEFAULT_PROXIMITY_RADIUS_KM and SECONDARY_PROXIMITY_RADIUS_KM', () => {
  const cfg = loadGeographyConfig({
    DEFAULT_PROXIMITY_RADIUS_KM: '3.5',
    SECONDARY_PROXIMITY_RADIUS_KM: '8',
  });
  assert.equal(cfg.defaultRadiusKm, 3.5);
  assert.equal(cfg.secondaryRadiusKm, 8);
});

test('loadGeographyConfig rejects non-positive radii', () => {
  const cfg = loadGeographyConfig({
    DEFAULT_PROXIMITY_RADIUS_KM: '0',
    SECONDARY_PROXIMITY_RADIUS_KM: '-5',
  });
  assert.equal(cfg.defaultRadiusKm, 5);
  assert.equal(cfg.secondaryRadiusKm, 15);
});

test('loadGeographyConfig falls back when ACTIVE_CITIES is invalid JSON', () => {
  const cfg = loadGeographyConfig({ ACTIVE_CITIES: '[broken json' });
  // Falls through to comma parsing which then fails (no commas) -> MVP defaults.
  assert.deepEqual(cfg.activeCities, ['Mexico City', 'Monterrey', 'Guadalajara']);
});

// ---------------------------------------------------------------------------
// resolveRadiusKm
// ---------------------------------------------------------------------------

test('resolveRadiusKm honours finite positive user value', () => {
  assert.equal(resolveRadiusKm({ proximityDistanceKm: 2 }, { defaultRadiusKm: 5 }), 2);
  assert.equal(resolveRadiusKm({ proximityDistanceKm: 0.5 }, { defaultRadiusKm: 5 }), 0.5);
});

test('resolveRadiusKm falls back to default when user value is null/0/missing', () => {
  assert.equal(resolveRadiusKm({ proximityDistanceKm: null }, { defaultRadiusKm: 5 }), 5);
  assert.equal(resolveRadiusKm({ proximityDistanceKm: undefined }, { defaultRadiusKm: 5 }), 5);
  assert.equal(resolveRadiusKm({ proximityDistanceKm: 0 }, { defaultRadiusKm: 5 }), 5,
    '0 should be treated as unset (BR-009: positive finite only)');
  assert.equal(resolveRadiusKm({}, { defaultRadiusKm: 5 }), 5);
  assert.equal(resolveRadiusKm(null, { defaultRadiusKm: 5 }), 5);
});

test('resolveRadiusKm rejects non-finite user values', () => {
  assert.equal(resolveRadiusKm({ proximityDistanceKm: NaN }, { defaultRadiusKm: 5 }), 5);
  assert.equal(resolveRadiusKm({ proximityDistanceKm: Infinity }, { defaultRadiusKm: 5 }), 5);
  assert.equal(resolveRadiusKm({ proximityDistanceKm: -3 }, { defaultRadiusKm: 5 }), 5);
});

// ---------------------------------------------------------------------------
// resolveSecondaryRadiusKm
// ---------------------------------------------------------------------------

test('resolveSecondaryRadiusKm widens by 3x with floor of secondaryRadiusKm', () => {
  const config = { defaultRadiusKm: 5, secondaryRadiusKm: 15 };
  assert.equal(resolveSecondaryRadiusKm({ proximityDistanceKm: 2 }, config), 15,
    '2*3=6, but the floor of 15 wins');
  assert.equal(resolveSecondaryRadiusKm({ proximityDistanceKm: 5 }, config), 15);
  assert.equal(resolveSecondaryRadiusKm({ proximityDistanceKm: 8 }, config), 24,
    '8*3=24 — wider than the floor');
  assert.equal(resolveSecondaryRadiusKm({}, config), 15);
});

test('resolveSecondaryRadiusKm respects custom secondaryRadiusKm', () => {
  assert.equal(
    resolveSecondaryRadiusKm({ proximityDistanceKm: 2 }, { defaultRadiusKm: 5, secondaryRadiusKm: 5 }),
    6,
    'floor is 5, computed widening is 6 → wins',
  );
});

// ---------------------------------------------------------------------------
// outOfServiceMessage
// ---------------------------------------------------------------------------

test('outOfServiceMessage names all active cities', () => {
  const message = outOfServiceMessage();
  assert.match(message, /Mexico City/);
  assert.match(message, /Monterrey/);
  assert.match(message, /Guadalajara/);
});

// ---------------------------------------------------------------------------
// Documentation
// ---------------------------------------------------------------------------

test('GEOGRAPHY_DESCRIPTION mentions BR-009 and BR-010', () => {
  assert.match(GEOGRAPHY_DESCRIPTION, /BR-009/);
  assert.match(GEOGRAPHY_DESCRIPTION, /BR-010/);
  assert.match(GEOGRAPHY_DESCRIPTION, /active city/i);
});
