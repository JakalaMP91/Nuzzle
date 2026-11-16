export type ShoppingNameMatch = { kind: "exact" | "similar"; name: string };

const modifiers = new Set(["bio", "frisch", "frische", "frischer", "frisches"]);
const compoundPrefixes = ["fettarme", "fettarmer", "fettarmes", "voll", "bio", "weizen", "dinkel"];

function normalize(name: string) {
  return name.toLocaleLowerCase("de-DE")
    .replaceAll("ä", "ae").replaceAll("ö", "oe").replaceAll("ü", "ue").replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function singular(token: string) {
  // Häufige deutsche Pluralformen, ohne kurze Namen wie „Eier“ zu verkürzen.
  if (token.length >= 6 && token.endsWith("en")) return token.slice(0, -1);
  if (token.length >= 7 && token.endsWith("eln")) return token.slice(0, -1);
  return token;
}

function variants(name: string) {
  const tokens = normalize(name).split(" ").filter((token) => token && !modifiers.has(token));
  const base = tokens.map(singular).join(" ");
  const result = new Set([base]);
  if (tokens.length === 1) {
    for (const prefix of compoundPrefixes) {
      if (tokens[0].startsWith(prefix) && tokens[0].length - prefix.length >= 4) {
        result.add(singular(tokens[0].slice(prefix.length)));
      }
    }
  }
  return result;
}

function oneEditApart(left: string, right: string) {
  if (left.length < 6 || right.length < 6 || Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length >= right.length) i++;
    if (right.length >= left.length) j++;
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

export function findShoppingNameMatch(candidate: string, names: readonly string[]): ShoppingNameMatch | null {
  const key = normalize(candidate);
  if (!key) return null;
  const exact = names.find((name) => normalize(name) === key);
  if (exact) return { kind: "exact", name: exact };

  const candidateVariants = variants(candidate);
  for (const name of names) {
    const matching = variants(name);
    if ([...candidateVariants].some((variant) => variant.length >= 4 && matching.has(variant))) {
      return { kind: "similar", name };
    }
  }
  const typo = names.find((name) => oneEditApart(key, normalize(name)));
  return typo ? { kind: "similar", name: typo } : null;
}
