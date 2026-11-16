import test from "node:test";
import assert from "node:assert/strict";
import { frequentPurchases } from "./shopping-frequent.ts";
const purchase = (name, checkedAt, amount=1) => ({item:{name,amount}, checkedAt});
test("Häufigkeit nutzt alle Einkäufe und den letzten Artikel", () => {
  const history=[purchase("Milch",1),purchase("  MILCH  ",4,2),purchase("Brot",2),purchase("Brot",3),purchase("Brot",5),purchase("Butter",6)];
  const groups=frequentPurchases(history);
  assert.deepEqual(groups.map(g=>[g.key,g.count]),[["brot",3],["milch",2]]);
  assert.equal(groups[1].item.amount,2);
  assert.deepEqual(frequentPurchases(history.filter(r=>r.checkedAt!==4)).map(g=>g.key),["brot"]);
});
test("Gleichstand ordnet nach letztem Einkauf und Namen bleiben eindeutig", () => {
 const result=frequentPurchases([purchase("Hafer Milch",1),purchase("hafer  milch",3),purchase("Milch",2),purchase("Milch",4)]);
 assert.deepEqual(result.map(g=>g.key),["milch","hafer milch"]);
 assert.deepEqual(frequentPurchases([]),[]);
});
