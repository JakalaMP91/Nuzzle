import assert from "node:assert/strict";
import test from "node:test";
import { getProductIcon, productIconCatalog, productIconGroups } from "./product-icon.ts";

test("ordnet häufige deutsche Einkaufsbegriffe zu", () => {
  const examples = [
    ["Vollmilch", "milk"], ["Äpfel", "apple"], ["Bananen", "banana"],
    ["Karotten", "carrot"], ["Spülmittel", "cleaner"], ["Kaffeebohnen", "coffee"],
    ["Eier", "egg"], ["Lachsfilet", "fish"], ["Hähnchenbrust", "drumstick"],
    ["Bergkäse", "hardCheese"], ["Basmatireis", "rice"], ["Haferdrink", "water"], ["Olivenöl", "oil"],
    ["Mandelblättchen", "nut"], ["Bio-Zitronen", "lemon"],
    ["Birnen", "pear"], ["Orangen", "orange"], ["Erdbeeren", "strawberry"],
    ["Blaubeeren", "blueberry"], ["Himbeeren", "raspberry"], ["Brombeeren", "blackberry"],
    ["Beerenmix", "berries"], ["Obst", "fruitBasket"], ["Tomaten", "tomato"],
    ["Kartoffeln", "potato"], ["Paprika", "pepper"], ["Brokkoli", "broccoli"],
    ["Zucchini", "zucchini"], ["Frühlingszwiebeln", "springOnion"],
    ["Salami", "salami"], ["Kochschinken", "ham"], ["Wiener Würstchen", "sausage"],
    ["Bacon", "bacon"], ["Brötchen", "bagel"],
    ["Pflaumen", "plum"], ["Zwetschgen", "plum"], ["Spargel", "asparagus"],
    ["Joghurt", "yogurt"], ["Butter", "butter"], ["Nudeln", "pasta"],
    ["Weizenmehl", "flour"], ["Trockenhefe", "yeast"], ["Zucker", "sugar"],
    ["Rote Linsen", "lentils"], ["Kreuzkümmel", "cumin"],
    ["Salz", "salt"], ["Meersalz", "salt"], ["Schwarzer Pfeffer", "blackPepper"],
    ["Paprikapulver", "paprikaPowder"], ["Edelsüß", "paprikaPowder"],
    ["Chiliflocken", "chiliPowder"], ["Kurkuma", "turmeric"], ["Currypulver", "curry"],
    ["Zimt", "cinnamon"], ["Muskatnuss", "nutmeg"], ["Basilikum", "herbs"],
    ["Vanillezucker", "vanilla"], ["Backpulver", "bakingPowder"],
    ["Spülsalz", "cleaner"],
  ];
  for (const [name, icon] of examples) assert.equal(getProductIcon(name), icon, name);
});

test("erkennt Beeren und Gewürzvarianten sowie neu ergänzte Produkte", () => {
  const examples = [
    ["TK-Himbeeren", "raspberry"], ["Brombeeren frisch", "blackberry"],
    ["Muskatnuss gemahlen", "nutmeg"], ["Muskatblüte", "nutmeg"],
    ["Vanilleschoten", "vanilla"], ["Bourbon-Vanillezucker", "vanilla"],
    ["Grüner Spargel", "asparagus"], ["Zwetschgen entsteint", "plum"],
  ];
  for (const [name, icon] of examples) assert.equal(getProductIcon(name), icon, name);
});

test("unterscheidet Käsearten und ordnet verwendete Zutaten gezielt zu", () => {
  const examples = [
    ["Parmesan", "hardCheese"], ["Pecorino", "hardCheese"], ["Grana Padano", "hardCheese"],
    ["Gouda in Scheiben", "slicedCheese"], ["Cheddar", "slicedCheese"],
    ["Camembert", "softCheese"], ["Brie", "softCheese"],
    ["Kräuterfrischkäse", "creamCheese"], ["Frischkäse mit Pfeffer", "creamCheese"], ["Ricotta", "creamCheese"],
    ["Körniger Frischkäse", "cottageCheese"], ["Hüttenkäse", "cottageCheese"],
    ["Burrata", "mozzarella"], ["Mozzarella", "mozzarella"], ["Feta", "feta"],
    ["Käse", "cheese"], ["Pancetta", "bacon"], ["Guanciale", "bacon"],
    ["Tomatenmark", "tomatoPaste"], ["Tomaten", "tomato"], ["Haferflocken", "oats"],
    ["Zwieback", "rusk"], ["Knäckebrot", "rusk"], ["Asant", "seasoning"], ["farine de gruau", "flour"], ["Orangenblüten Aroma", "flavouring"],
  ];
  for (const [name, icon] of examples) assert.equal(getProductIcon(name), icon, name);
});

test("verwendet für unbekannte Artikel ein neutrales Icon", () => {
  assert.equal(getProductIcon("Unbekannter Artikel"), "package");
  assert.equal(getProductIcon(""), "package");
});

test("der Katalog enthält eindeutige Symbole und Sammel-Icons für alle Gruppen", () => {
  const ids = productIconCatalog.map((entry) => entry.icon);
  assert.ok(ids.length >= 70);
  assert.equal(new Set(ids).size, ids.length);
  for (const group of productIconGroups) assert.ok(productIconCatalog.some((entry) => entry.group === group), group);
  assert.ok(ids.includes("fruitBasket"));
  assert.ok(ids.includes("berries"));
  assert.ok(ids.includes("vegetables"));
  assert.ok(productIconCatalog.every((entry) => "emoji" in entry || "asset" in entry));
  assert.equal(productIconCatalog.find((entry) => entry.icon === "fruitBasket")?.label, "Obst allgemein");
  assert.equal(productIconCatalog.find((entry) => entry.icon === "vegetables")?.label, "Gemüse allgemein");
});
