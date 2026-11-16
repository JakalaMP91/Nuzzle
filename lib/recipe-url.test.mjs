import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRecipeUrl } from './recipe-url.ts';

test('akzeptiert öffentliche Rezeptlinks und entfernt Fragmente', () => {
  assert.equal(normalizeRecipeUrl(' https://example.com/rezept?k=1#zutaten '), 'https://example.com/rezept?k=1');
  assert.equal(normalizeRecipeUrl('http://rezepte.example.org/gericht'), 'http://rezepte.example.org/gericht');
});

test('weist lokale und nicht-webbasierte Adressen ab', () => {
  for (const value of ['http://localhost:5173', 'http://127.0.0.1/', 'http://192.168.1.2/', 'http://[::1]/', 'http://router.local/', 'file:///rezept.txt', 'javascript:alert(1)', 'https://user:pass@example.com/', 'https://example.com:8080/']) {
    assert.equal(normalizeRecipeUrl(value), null, value);
  }
});
