import assert from 'node:assert/strict'
import test from 'node:test'

import { regionAbbreviation, regionFilterPrefix } from '../src/lib/regions.js'

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
