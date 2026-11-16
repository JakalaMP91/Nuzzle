import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoffeeBackup } from './coffee-import.ts';

const coffee = { id: 'one', name: 'Kaffee', type: 'normal', createdAt: 1, updatedAt: 2, taste: 'gut', rating: 4, profiles: [] };
const backup = { app: 'kaffee-tracker', schemaVersion: 1, coffees: [coffee], profileNames: ['Espresso', 'Espresso'] };
test('preserves legacy values and defaults', () => {
  const result = parseCoffeeBackup(backup);
  assert.equal(result.coffees[0].available, true);
  assert.equal(result.coffees[0].profiles[0].taste, 'gut');
  assert.equal(result.coffees[0].profiles[0].rating, 4);
  assert.deepEqual(result.profileNames, ['Espresso']);
});
test('rejects duplicate IDs and unsupported schema without partial result', () => {
  assert.throws(() => parseCoffeeBackup({ ...backup, coffees: [coffee, coffee] }));
  assert.throws(() => parseCoffeeBackup({ ...backup, schemaVersion: 2 }));
});
