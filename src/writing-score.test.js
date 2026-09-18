import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreWriting } from './writing-score.js';

function mask(indices) {
  const data = new Uint8ClampedArray(400);
  for (const i of indices) data[i * 4 + 3] = 255;
  return data;
}
const glyph = mask(Array.from({ length: 20 }, (_, i) => i));
test('exact tracing yields full power', () => {
  const result = scoreWriting(glyph, glyph);
  assert.equal(result.tier, 'perfect');
  assert.equal(result.power, 1);
});
test('tiny overlap yields tiny damage multiplier', () => {
  const result = scoreWriting(glyph, mask([0]));
  assert.equal(result.tier, 'weak');
  assert.equal(result.power, .05);
});
test('painting the entire canvas fails despite complete coverage', () => {
  const result = scoreWriting(glyph, mask(Array.from({ length: 100 }, (_, i) => i)));
  assert.equal(result.coverage, 1);
  assert.equal(result.tier, 'flooded');
  assert.equal(result.power, 0);
});
test('blank and off-target writing have zero power', () => {
  assert.equal(scoreWriting(glyph, mask([])).power, 0);
  assert.equal(scoreWriting(glyph, mask([90, 91])).power, 0);
});
