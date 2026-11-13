import test from 'node:test';
import assert from 'node:assert/strict';
import { knockOutWhite } from '../src/cutout.js';

// Build a w x h RGBA image from a per-pixel colour function (r,g,b,a).
const make = (w, h, fn) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(fn(x, y), (y * w + x) * 4);
  return d;
};
const alphaAt = (d, w, x, y) => d[(y * w + x) * 4 + 3];
const WHITE = [255, 255, 255, 255];
const RED = [200, 20, 20, 255];

test('white border around a coloured block is removed, block kept', () => {
  const w = 8, h = 8;
  const d = make(w, h, (x, y) => (x >= 2 && x < 6 && y >= 2 && y < 6 ? RED : WHITE));
  assert.equal(knockOutWhite(d, w, h), true);
  assert.equal(alphaAt(d, w, 0, 0), 0);
  assert.equal(alphaAt(d, w, 7, 7), 0);
  assert.equal(alphaAt(d, w, 3, 3), 255);
});

test('white enclosed by a coloured ring stays opaque', () => {
  const w = 9, h = 9;
  const d = make(w, h, (x, y) => {
    const ring = x >= 2 && x <= 6 && y >= 2 && y <= 6 && (x === 2 || x === 6 || y === 2 || y === 6);
    return ring ? RED : WHITE;
  });
  knockOutWhite(d, w, h);
  assert.equal(alphaAt(d, w, 0, 0), 0);
  assert.equal(alphaAt(d, w, 4, 4), 255);
});

test('image that already has transparent pixels is untouched and returns false', () => {
  const w = 4, h = 4;
  const d = make(w, h, (x, y) => (x === 0 && y === 0 ? [255, 255, 255, 0] : WHITE));
  const before = Uint8ClampedArray.from(d);
  assert.equal(knockOutWhite(d, w, h), false);
  assert.deepEqual(d, before);
});

test('near-white 249 is kept at threshold 250', () => {
  const w = 4, h = 4;
  const d = make(w, h, () => [249, 249, 249, 255]);
  assert.equal(knockOutWhite(d, w, h), false);
  assert.equal(alphaAt(d, w, 0, 0), 255);
});

test('fully white image becomes fully transparent', () => {
  const w = 5, h = 3;
  const d = make(w, h, () => WHITE);
  assert.equal(knockOutWhite(d, w, h), true);
  for (let i = 0; i < w * h; i++) assert.equal(d[i * 4 + 3], 0);
});
