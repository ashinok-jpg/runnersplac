import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTags } from '../src/core/tag.js';
import { CONFIG } from '../src/config.js';
import { makeEntity } from './helpers.js';

const it = (over) => makeEntity({ id: 'player', isIt: true, pos: { x: 100, y: 100 }, ...over });

test('重なると鬼が交代し、新しい鬼は硬直＆タッチ返し禁止', () => {
  const ents = [it(), makeEntity({ id: 'cpu1', pos: { x: 120, y: 100 } })];
  const { entities, events } = resolveTags(ents, 5);
  const [p, c] = entities;
  assert.equal(p.isIt, false);
  assert.equal(c.isIt, true);
  assert.equal(c.frozenUntil, 5 + CONFIG.TAG_FREEZE_SEC);
  assert.equal(c.noTagBackId, 'player');
  assert.deepEqual(events, [{ type: 'tag', from: 'player', to: 'cpu1', time: 5 }]);
});

test('離れていれば交代しない', () => {
  const { entities, events } = resolveTags([it(), makeEntity({ pos: { x: 129, y: 100 } })], 5);
  assert.equal(entities[0].isIt, true);
  assert.equal(events.length, 0);
});

test('硬直中の鬼はタッチできない', () => {
  const { events } = resolveTags([it({ frozenUntil: 6 }), makeEntity({ pos: { x: 110, y: 100 } })], 5.5);
  assert.equal(events.length, 0);
});

test('タッチ返し禁止の相手にはタッチできない（硬直解除前）', () => {
  const ents = [it({ frozenUntil: 6, noTagBackId: 'cpu1' }), makeEntity({ id: 'cpu1', pos: { x: 110, y: 100 } })];
  assert.equal(resolveTags(ents, 5.9).events.length, 0);
});

test('1 ステップで交代は最大 1 回、鬼は常に 1 人', () => {
  const ents = [it(), makeEntity({ id: 'cpu1', pos: { x: 105, y: 100 } }), makeEntity({ id: 'cpu2', pos: { x: 100, y: 110 } })];
  const { entities, events } = resolveTags(ents, 3);
  assert.equal(events.length, 1);
  assert.equal(entities.filter((e) => e.isIt).length, 1);
  assert.equal(events[0].to, 'cpu1', '一番近い相手が鬼になる');
});

test('入力を変更しない', () => {
  const ents = [it(), makeEntity({ pos: { x: 110, y: 100 } })];
  const snap = JSON.stringify(ents);
  resolveTags(ents, 1);
  assert.equal(JSON.stringify(ents), snap);
});
