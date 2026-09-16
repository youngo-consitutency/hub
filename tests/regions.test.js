import assert from 'node:assert/strict'
import test from 'node:test'

import {
  regionAbbreviation,
  regionFilterPrefix,
  regionKey,
  regionLabel,
} from '../src/lib/regions.js'

test('region filters use stable, recognizable abbreviations', () => {
  assert.equal(regionAbbreviation('Africa'), 'AFR')
  assert.equal(regionAbbreviation('apac'), 'AP')
  assert.equal(regionAbbreviation('ECA'), 'ECA')
  assert.equal(regionAbbreviation('LAC'), 'LAC')
  assert.equal(regionAbbreviation('MENA'), 'MENA')
  assert.equal(regionAbbreviation('North America'), 'NA')
  assert.equal(regionAbbreviation('WEOG'), 'WEOG')
  assert.equal(regionAbbreviation('Europe'), 'EUR')
})

test('unknown region labels receive a compact deterministic fallback', () => {
  assert.equal(regionAbbreviation('Central Asia'), 'CA')
  assert.equal(regionAbbreviation('Caribbean'), 'CAR')
  assert.equal(regionAbbreviation(''), '')
})

test('an already abbreviated label does not repeat itself', () => {
  assert.equal(regionFilterPrefix('eca', 'ECA'), '')
  assert.equal(regionFilterPrefix('MENA'), '')
  assert.equal(regionFilterPrefix('Africa'), 'AFR')
  assert.equal(regionFilterPrefix('North America'), 'NA')
})

test('stored region codes and imported aliases share display names and filter keys', () => {
  for (const [values, key, label] of [
    [['asia_pacific', 'Asia-Pacific', 'APAC'], 'asia_pacific', 'Asia-Pacific'],
    [['eca', 'Europe & Central Asia'], 'eca', 'Europe & Central Asia'],
    [
      ['lac', 'Latin America & Caribbean'],
      'lac',
      'Latin America & the Caribbean',
    ],
    [
      ['mena', 'Middle East and North Africa'],
      'mena',
      'Middle East & North Africa',
    ],
    [
      ['north_america', 'noram', 'North America'],
      'north_america',
      'North America',
    ],
    [['africa', ' Africa '], 'africa', 'Africa'],
    [['global', 'Global'], 'global', 'Global'],
  ]) {
    for (const value of values) {
      assert.equal(regionKey(value), key)
      assert.equal(regionLabel(value), label)
    }
  }
  assert.equal(regionLabel('central_asia'), 'Central Asia')
  assert.equal(regionLabel(null), '')
})
