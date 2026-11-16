import assert from "node:assert/strict";
import test from "node:test";
import { extractRecipePage } from "./recipe-extract.ts";

test("liest das Titelbild aus strukturierten Rezeptdaten", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "Pfannkuchen", recipeIngredient: ["Mehl", "Eier"], image: [{ url: "/bilder/pfannkuchen.jpg" }] })}</script>`;
  const result = extractRecipePage(html, "https://rezepte.example/gerichte/pfannkuchen");
  assert.equal(result.imageUrl, "https://rezepte.example/bilder/pfannkuchen.jpg");
  assert.equal(JSON.parse(result.summary).title, "Pfannkuchen");
});

test("nutzt Open-Graph-Bild als Ersatz und lehnt unsichere Bildadressen ab", () => {
  const pageUrl = "https://rezepte.example/pfannkuchen";
  assert.equal(extractRecipePage('<meta content="https://bilder.example/rezept.jpg?x=1&amp;y=2" property="og:image">', pageUrl).imageUrl, "https://bilder.example/rezept.jpg?x=1&y=2");
  assert.equal(extractRecipePage('<meta property="og:image" content="http://localhost/private.jpg">', pageUrl).imageUrl, null);
});
