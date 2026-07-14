import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PLATFORM,
  MAPS_PROVIDERS,
  NAVIGATION_DESCRIPTION,
  PLATFORMS,
  buildMapsUrls,
  parsePlatform,
} from '../src/modules/navigation/navigationPolicy.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test('MAPS_PROVIDERS lists google, apple, waze', () => {
  assert.deepEqual([...MAPS_PROVIDERS], ['google', 'apple', 'waze']);
});

test('PLATFORMS lists ios, android, web', () => {
  assert.deepEqual([...PLATFORMS], ['ios', 'android', 'web']);
});

test('DEFAULT_PLATFORM is web', () => {
  assert.equal(DEFAULT_PLATFORM, 'web');
});

// ---------------------------------------------------------------------------
// parsePlatform
// ---------------------------------------------------------------------------

test('parsePlatform accepts known platforms case-insensitively', () => {
  assert.equal(parsePlatform('ios'), 'ios');
  assert.equal(parsePlatform('iOS'), 'ios');
  assert.equal(parsePlatform('ANDROID'), 'android');
  assert.equal(parsePlatform('web'), 'web');
});

test('parsePlatform falls back to web for unknown / empty values', () => {
  assert.equal(parsePlatform('blackberry'), 'web');
  assert.equal(parsePlatform(''), 'web');
  assert.equal(parsePlatform(null), 'web');
  assert.equal(parsePlatform(undefined), 'web');
  assert.equal(parsePlatform('   '), 'web');
});

// ---------------------------------------------------------------------------
// buildMapsUrls — Google Maps (always web)
// ---------------------------------------------------------------------------

test('buildMapsUrls builds Google directions URL when origin is supplied', () => {
  const result = buildMapsUrls({ origin: '19.4326,-99.1332', destination: '19.5,-99.2' });
  assert.equal(
    result.google.url,
    'https://www.google.com/maps/dir/?api=1&origin=19.4326,-99.1332&destination=19.5,-99.2',
  );
  assert.equal(result.google.fallbackReason, null);
});

test('buildMapsUrls builds Google search URL when origin is missing', () => {
  const result = buildMapsUrls({ origin: null, destination: '19.5,-99.2' });
  assert.equal(result.google.url, 'https://www.google.com/maps/search/?api=1&query=19.5,-99.2');
  assert.equal(result.google.fallbackReason, null);
});

// ---------------------------------------------------------------------------
// buildMapsUrls — Apple Maps
// ---------------------------------------------------------------------------

test('buildMapsUrls builds Apple deep link when platform is ios', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2', platform: 'ios' });
  assert.equal(result.apple.url, 'maps://?daddr=19.5,-99.2&dirflg=d');
  assert.equal(result.apple.fallbackReason, null);
});

test('buildMapsUrls builds Apple deep link when platform is android', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2', platform: 'android' });
  assert.equal(result.apple.url, 'maps://?daddr=19.5,-99.2&dirflg=d');
  assert.equal(result.apple.fallbackReason, null);
});

test('buildMapsUrls builds Apple web URL when platform is web', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2', platform: 'web' });
  assert.equal(
    result.apple.url,
    'https://maps.apple.com/?daddr=19.5,-99.2&dirflg=d',
  );
  assert.equal(result.apple.fallbackReason, 'no_native_app');
});

// ---------------------------------------------------------------------------
// buildMapsUrls — Waze
// ---------------------------------------------------------------------------

test('buildMapsUrls builds Waze deep link when platform is ios', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2', platform: 'ios' });
  assert.equal(result.waze.url, 'waze://?ll=19.5,-99.2&navigate=yes');
  assert.equal(result.waze.fallbackReason, null);
});

test('buildMapsUrls builds Waze deep link when platform is android', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2', platform: 'android' });
  assert.equal(result.waze.url, 'waze://?ll=19.5,-99.2&navigate=yes');
  assert.equal(result.waze.fallbackReason, null);
});

test('buildMapsUrls builds Waze web URL when platform is web', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2', platform: 'web' });
  assert.equal(
    result.waze.url,
    'https://waze.com/ul?ll=19.5,-99.2&navigate=yes',
  );
  assert.equal(result.waze.fallbackReason, 'no_native_app');
});

// ---------------------------------------------------------------------------
// Defaults + shape
// ---------------------------------------------------------------------------

test('buildMapsUrls defaults platform to web', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2' });
  assert.match(result.apple.url, /^https:\/\/maps\.apple\.com\//);
  assert.equal(result.apple.fallbackReason, 'no_native_app');
  assert.equal(result.waze.fallbackReason, 'no_native_app');
});

test('buildMapsUrls always returns google, apple, waze keys', () => {
  const result = buildMapsUrls({ destination: '19.5,-99.2', platform: 'ios' });
  assert.deepEqual(Object.keys(result).sort(), ['apple', 'google', 'waze']);
});

test('buildMapsUrls throws when destination is missing', () => {
  assert.throws(() => buildMapsUrls({ destination: null }), /requires a destination/);
  assert.throws(() => buildMapsUrls({}), /requires a destination/);
});

// ---------------------------------------------------------------------------
// Documentation
// ---------------------------------------------------------------------------

test('NAVIGATION_DESCRIPTION mentions BR-012 and the three providers', () => {
  assert.match(NAVIGATION_DESCRIPTION, /BR-012/);
  assert.match(NAVIGATION_DESCRIPTION, /Google Maps/);
  assert.match(NAVIGATION_DESCRIPTION, /Apple Maps/);
  assert.match(NAVIGATION_DESCRIPTION, /Waze/);
  assert.match(NAVIGATION_DESCRIPTION, /no_native_app/);
});