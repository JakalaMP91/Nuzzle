import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoffeeService } from './coffee-service.ts';

function database() {
  let row = null;
  return { prepare(sql) { return { bind(...args) { return { async first() {
    if (sql.startsWith('INSERT')) { if (row) return null; row = { revision: 1, data: args[0] }; return { revision: 1 }; }
    if (sql.startsWith('UPDATE')) { if (!row || row.revision !== args[2]) return null; row = { revision: row.revision + 1, data: args[0] }; return { revision: row.revision }; }
  } }; }, async first() { return row; } }; } };
}
const request = (revision, data, origin = 'https://nuzzle.test') => new Request('https://nuzzle.test/api/coffee', { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ revision, data }) });
const data = { coffees: [{ id: 'a', name: 'A', type: 'normal', available: true, photo: null, profiles: [{ grind: '', amount: '', extractionProfile: '', taste: '', rating: 0, comment: '' }], createdAt: 1, updatedAt: 2 }], profileNames: [] };
test('revision conflict does not overwrite cloud data', async () => {
  const service = createCoffeeService({ db: database(), identify: async () => 'user' });
  assert.equal((await service.PUT(request(0, data))).status, 200);
  assert.equal((await service.PUT(request(0, { ...data, coffees: [] }))).status, 409);
  const response = await service.GET(new Request('https://nuzzle.test/api/coffee'));
  const saved = await response.json(); assert.equal(saved.revision, 1); assert.equal(saved.data.coffees.length, 1);
});
test('rejects unauthenticated and cross-origin writes', async () => {
  const denied = createCoffeeService({ db: database(), identify: async () => null });
  assert.equal((await denied.PUT(request(0, data))).status, 401);
  const service = createCoffeeService({ db: database(), identify: async () => 'user' });
  assert.equal((await service.PUT(request(0, data, 'https://example.test'))).status, 403);
});
