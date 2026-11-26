import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLocationOptions, updateAddressSelection, createShippingAddress } from '../../client/src/checkout-address.js';

const locations = JSON.parse(readFileSync(new URL('../../client/src/data/psgc-locations.json', import.meta.url), 'utf8'));

test('PSGC address options cascade through region, province, city, and barangay', () => {
  const cagayanRegion = locations.regions.find(([, name]) => name.includes('Cagayan Valley'));
  const regionProvinces = getLocationOptions(locations, 'province', cagayanRegion[0]);
  const cagayan = regionProvinces.find(option => option.name === 'Cagayan');
  assert.ok(cagayan);
  assert.ok(regionProvinces.every(option => locations.provinces.find(row => row[0] === option.code)[2] === cagayanRegion[0]));

  const cities = getLocationOptions(locations, 'city', cagayan.code);
  assert.ok(cities.length > 0);
  assert.ok(cities.every(option => locations.cities.find(row => row[0] === option.code)[2] === cagayan.code));

  const barangays = getLocationOptions(locations, 'barangay', cities[0].code);
  assert.ok(barangays.length > 0);
  assert.ok(barangays.every(option => locations.barangays.find(row => row[0] === option.code)[2] === cities[0].code));
});

test('changing a parent address selection clears every dependent selection', () => {
  const initial = { region: 'r1', province: 'p1', city: 'c1', barangay: 'b1' };
  assert.deepEqual(updateAddressSelection(initial, 'region', 'r2'), {
    region: 'r2', province: '', city: '', barangay: '',
  });
  assert.deepEqual(updateAddressSelection(initial, 'province', 'p2'), {
    region: 'r1', province: 'p2', city: '', barangay: '',
  });
  assert.deepEqual(updateAddressSelection(initial, 'city', 'c2'), {
    region: 'r1', province: 'p1', city: 'c2', barangay: '',
  });
});

test('shipping address includes street and every selected PSGC level', () => {
  const region = locations.regions.find(([, name]) => name.includes('Cagayan Valley'));
  const province = getLocationOptions(locations, 'province', region[0]).find(option => option.name === 'Cagayan');
  const city = getLocationOptions(locations, 'city', province.code)[0];
  const barangay = getLocationOptions(locations, 'barangay', city.code)[0];
  const selection = { region: region[0], province: province.code, city: city.code, barangay: barangay.code };

  assert.equal(
    createShippingAddress(locations, selection, '123 Sample Street'),
    `123 Sample Street, ${barangay.name}, ${city.name}, ${province.name}, ${region[1]}`,
  );
});

test('NCR skips the synthetic province and resolves city and barangay directly', () => {
  const region = locations.regions.find(([, name]) => name === 'National Capital Region (NCR)');
  const provinces = getLocationOptions(locations, 'province', region[0]);
  assert.deepEqual(provinces, []);

  const cities = getLocationOptions(locations, 'city', region[0]);
  assert.ok(cities.length > 0);
  const city = cities.find(option => option.name === 'City of Makati') || cities[0];
  const barangays = getLocationOptions(locations, 'barangay', city.code);
  assert.ok(barangays.length > 0);
  const barangay = barangays[0];
  const address = createShippingAddress(locations, {
    region: region[0],
    province: '',
    city: city.code,
    barangay: barangay.code,
  }, '123 Sample Street');

  assert.equal(address, `123 Sample Street, ${barangay.name}, ${city.name}, ${region[1]}`);
  assert.doesNotMatch(address, /Metro Manila/);
});

test('incomplete or mismatched address selections are rejected', () => {
  assert.throws(
    () => createShippingAddress(locations, { region: '', province: '', city: '', barangay: '' }, '123 Sample Street'),
    /Select a valid Region/,
  );
  const region = locations.regions.find(([, name]) => name.includes('Cagayan Valley'));
  const province = getLocationOptions(locations, 'province', region[0]).find(option => option.name === 'Cagayan');
  assert.throws(
    () => createShippingAddress(locations, { region: region[0], province: 'not-a-child', city: '', barangay: '' }, '123 Sample Street'),
    /Select a valid Province/,
  );
  assert.throws(
    () => createShippingAddress(locations, { region: region[0], province: province.code, city: '', barangay: '' }, '   '),
    /Enter your street/,
  );
});
