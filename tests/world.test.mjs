import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, HILL, layerIndexAt } from '../js/config.js';
import { createWorld, HAZARDS } from '../js/world.js';
import { createTerrain } from '../js/terrain.js';

const strip = (o) => JSON.stringify(o);

test('generation is deterministic per seed and differs between seeds', () => {
  const a = createWorld(42).query(0, 0, 3000, 8000);
  const b = createWorld(42).query(0, 0, 3000, 8000);
  const c = createWorld(43).query(0, 0, 3000, 8000);
  assert.equal(strip(a), strip(b));
  assert.notEqual(strip(a), strip(c));
  assert.ok(a.length > 50);
});

test('objects belong to their layer', () => {
  const objs = createWorld(5).query(0, 0, 6000, 10000);
  const onlyIn = { plane: 'jet', ufo: 'strato', satellite: 'space', asteroid: 'space', thunder: 'clouds', wballoon: 'strato' };
  for (const o of objs) {
    const want = onlyIn[o.type];
    if (want) assert.equal(LAYERS[layerIndexAt(o.y)].id, want, `${o.type} at ${o.y}`);
  }
});

test('no hazards in the launch area and nothing inside the hill', () => {
  const world = createWorld(9);
  const objs = world.query(-50, 0, 90, 150).filter((o) => o.x < 90);
  for (const o of objs) {
    assert.ok(!HAZARDS.has(o.type), `${o.type} near launch`);
    if (o.type === 'coin') assert.ok(o.y > world.terrain.height(o.x), 'coin underground');
  }
});

test('a starter coin trail exists for the first flights', () => {
  const coins = createWorld(1).query(0, 0, 50, 40).filter((o) => o.type === 'coin' && o.x < 50);
  assert.ok(coins.length >= 8);
});

test('terrain: flat launch plateau, slopes down, features are clear of the launch', () => {
  const t = createTerrain(4);
  assert.equal(t.height(-10), HILL);
  assert.equal(t.height(0), HILL);
  assert.ok(t.height(40) < HILL && t.height(40) > 0);
  for (const seg of t.segments(-100, 80)) assert.equal(seg.feature, null);
  const types = new Set();
  for (const seg of t.segments(0, 40000)) if (seg.feature) types.add(seg.feature.type);
  assert.deepEqual([...types].sort(), ['haystack', 'mud', 'pond', 'tnt', 'trampoline']);
  for (const seg of t.segments(100, 20000)) {
    const ft = seg.feature;
    if (ft && (ft.type === 'pond' || ft.type === 'mud')) {
      assert.equal(t.surface((ft.x0 + ft.x1) / 2), ft.type);
      assert.ok(Math.abs(t.height((ft.x0 + ft.x1) / 2)) < 0.01, 'water and mud are flat');
    }
  }
});
