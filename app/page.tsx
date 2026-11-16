"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { version as appVersion } from "../package.json";
import {
  ArrowLeft, ArrowRight, BookOpen, CakeSlice, CalendarDays, Camera, Check, ChevronDown, CircleUserRound,
  CircleAlert, ClipboardCheck, Clock3, CookingPot, Croissant, GripVertical, Heart, HouseHeart, LayoutPanelTop,
  ExternalLink, FileText, Image as ImageIcon, ImagePlus, ListFilter, MessageCircle, Minus, PartyPopper, Pencil, Plus, Search, ShoppingBasket,
  Bell, Settings, Sparkles, Star, Trash2, Undo2, UsersRound, X,
} from "lucide-react";
import { getProductIcon, productIconCatalog, productIconGroups, type ProductIcon } from "@/lib/product-icon";
import { findShoppingNameMatch, type ShoppingNameMatch } from "@/lib/shopping-similarity";
import { groupRecentPurchases } from "@/lib/shopping-recent";
import { frequentPurchases } from "@/lib/shopping-frequent";
import { isPantryIngredient } from "@/lib/pantry-match";
import { combineRecipeVersions } from "@/lib/recipe-versions";
import { formatRecipeQuantity, parsePositiveAmount, parseRecipeQuantity, shoppingUnits, type ShoppingUnit } from "@/lib/recipe-quantity";
import { NuzzleLoadingMark } from "@/components/nuzzle-loading-mark";
import { NuzzleThemeSettings } from "@/components/nuzzle-theme";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useHouseholdSync } from "@/lib/use-household-sync";
import { syncLog } from "@/lib/sync-log";
import { useHouseholdNotices } from "@/lib/use-household-notices";
import type { HouseholdData } from "@/lib/household-data";
import { householdKeys, parseHouseholdData } from "@/lib/household-data";
import { applyImageReplacements, applyTaskImageReplacements, imageIdFromPath, isEmbeddedImage } from "@/lib/household-images";
import { useAppBack, type AppNavigation } from "@/lib/use-app-back";
import { resolveRestoreLane } from "@/lib/task-archive";
import type { CommentAuthor } from "@/lib/household-identity";
import { mergeReadCommentIds, taskActivity } from "@/lib/task-activity";
import { taskDraftChanged } from "@/lib/task-draft";
import { describeNotices, noticePreviews, type NoticeState, type PreviewKind } from "@/lib/household-notices";

import { reminderOptions, taskDueAt, taskReminderState } from "@/lib/task-reminders";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { sortRecipes, unfamiliarRecipeIds, type RecipeSort } from "@/lib/recipe-library";
import { scaleIngredientDetail, stepIngredientDetail } from "@/lib/recipe-step-amounts";

type View = "home" | "shopping" | "recipes" | "tasks" | "settings";
type RecipeIcon = "bread" | "pot" | "cake";
type RecipeSource = "images" | "pdf" | "text" | "manual";
type ShoppingItem = {
  id: number; name: string; amount?: number; count?: number; weight?: number; unit?: ShoppingUnit;
  productType?: string; detail?: string; note?: string; icon: ProductIcon; iconOverride?: ProductIcon; source?: string; frequentTemplateId?: number; frequentKey?: string; addedAt?: number; lastPurchasedAt?: number; createdBy?: CommentAuthor; iconPreference?: boolean;
};
type SuggestionTarget = { kind: "recent" | "recipeRecent" | "pantry" | "history" | "frequent"; id: number | string; item: ShoppingItem };
type ShoppingSort = "custom" | "alphabetical" | "chronological";
function sortShopping(items: ShoppingItem[], mode: ShoppingSort) {
  if (mode === "alphabetical") return [...items].sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (mode === "chronological") {
    const timestamp = (item: ShoppingItem) => item.addedAt ?? (item.id >= 946684800000 && item.id < 4102444800000 ? item.id : 0);
    return [...items].sort((a, b) => timestamp(a) - timestamp(b));
  }
  return items;
}
type PurchaseRecord = { id: string; item: ShoppingItem; checkedAt: number; actor?: CommentAuthor };
type Ingredient = { id: string; name: string; detail: string; icon: ProductIcon; optional?: boolean; pantry?: boolean };
type RecipeStep = { id: string; text: string; ingredientIds: string[]; ingredientAmounts?: Record<string, string>; output?: string; inputStepIds?: string[] };
type RecipeVariantGroup = { id: string; title: string; replaces: string[]; options: { id: string; label: string; ingredients: Ingredient[] }[] };
type RecipeVersion = { id: string; title: string; ingredients: Ingredient[]; steps: RecipeStep[] };
type Recipe = {
  id: string; title: string; description: string; categories: string[]; icon: RecipeIcon;
  image?: string; sourceUrl?: string; sourceType?: RecipeSource; minutes: number | null; servings: number | null; rating: number; favorite: boolean; createdBy?: CommentAuthor; createdAt?: number;
  tryLater: boolean; prepared?: number; cooked?: number; baked?: number; lastPrepared?: string; ingredients: Ingredient[]; steps?: RecipeStep[]; versions?: RecipeVersion[]; variantGroups?: RecipeVariantGroup[];
};

type RecipeDraft = {
  id?: string; title: string; description: string; categories: string[]; minutes: number | null;
  servings: number | null; prepared: number; ingredients: Ingredient[]; steps: RecipeStep[]; versions: RecipeVersion[]; image?: string; sourceUrl?: string; sourceType?: RecipeSource;
};
type TaskView = "board" | "calendar";
type TaskLane = { id: string; title: string; color: string };
type TaskDropTarget = { laneId: string; taskId: number | null; position: "before" | "after" };
type ShoppingDropTarget = { itemId: number | null; position: "before" | "after" };
type TaskPerson = "Markus" | "Bettina" | "Gemeinsam";
type TaskComment = { id: string; author: "Markus" | "Bettina"; text: string; createdAt: string; pushEligible?: boolean };
type HouseholdTask = { id: number; title: string; status: string; assignee: TaskPerson | "Ich" | "Partner"; dueDate?: string; dueTime?: string; reminderMinutes?: number; createdAt?: number; note?: string; description?: string; priority?: "Niedrig" | "Mittel" | "Hoch"; images?: string[]; imageAuthors?: (CommentAuthor | null)[]; comments?: TaskComment[]; done?: boolean; completedAt?: string; createdBy?: CommentAuthor; completedBy?: CommentAuthor };
const taskPerson = (person?: HouseholdTask["assignee"]): TaskPerson => person === "Ich" ? "Markus" : person === "Partner" ? "Bettina" : person ?? "Gemeinsam";

function TaskReminderLabel({ task, now }: { task: HouseholdTask; now: number }) {
  const state = taskReminderState(task, now);
  return state === "none" ? null : <span className={`task-reminder-label reminder-${state}`}><Clock3 aria-hidden="true" />{state === "overdue" ? "Überfällig" : "Heute fällig"}</span>;
}

function TaskActivity({ task, readIds, author }: { task: HouseholdTask; readIds?: string[]; author: CommentAuthor | null }) {
  const counts = taskActivity(task.comments, task.images, readIds, author);
  return <span className="task-activity"><span className="task-activity-count" aria-label={`${counts.comments} Kommentare, ${counts.unread} ungelesen`}><MessageCircle aria-hidden="true" />{counts.comments}{counts.unread > 0 && <span className="task-activity-unread" aria-hidden="true">+{counts.unread}</span>}</span><span className="task-activity-count" aria-label={`${counts.images} Fotos`}><ImageIcon aria-hidden="true" />{counts.images}</span></span>;
}

const recipeIcons = { bread: Croissant, pot: CookingPot, cake: CakeSlice };
const initialItems: ShoppingItem[] = [
  { id: 1, name: "Vollmilch", amount: 2, unit: "l", productType: "3,5 %", icon: "milk", source: "Kartoffelgratin" },
  { id: 2, name: "Äpfel", amount: 5, unit: "Stk", productType: "Braeburn", icon: "apple" },
  { id: 3, name: "Karotten", amount: 500, unit: "g", note: "am liebsten lose", icon: "carrot", source: "Linseneintopf" },
  { id: 4, name: "Spülmittel", amount: 1, unit: "Stk", productType: "sensitiv", icon: "cleaner" },
];
const seedRecent: ShoppingItem[] = [
  { id: 101, name: "Haferflocken", detail: "500 g · zart", icon: "bread" },
  { id: 102, name: "Kaffeebohnen", detail: "1 kg · Espresso", icon: "coffee" },
];
const initialTasks: HouseholdTask[] = [
  { id: 1, title: "Spülmaschine ausräumen", status: "open", assignee: "Gemeinsam", dueDate: "2026-09-22" },
  { id: 2, title: "Kräuter gießen", status: "doing", assignee: "Ich", dueDate: "2026-09-23" },
  { id: 3, title: "Altglas wegbringen", status: "done", assignee: "Partner" },
];
const initialPantry: ShoppingItem[] = [
  { id: 301, name: "Zucchini", detail: "2 Stück", icon: "carrot" },
  { id: 302, name: "Kaffeebohnen", detail: "1 kg", icon: "coffee" },
  { id: 303, name: "Milch", detail: "1 l", icon: "milk" },
];
const seedPurchaseHistory: PurchaseRecord[] = [
  { id: "sample-rice", item: { id: 401, name: "Basmatireis", amount: 1, unit: "kg", icon: "bread" }, checkedAt: Date.now() - 124 * 86400000 },
  { id: "sample-tomatoes", item: { id: 402, name: "Passierte Tomaten", amount: 2, unit: "Stk", icon: "carrot" }, checkedAt: Date.now() - 91 * 86400000 },
  { id: "sample-oats", item: { id: 403, name: "Haferdrink", amount: 1, unit: "l", icon: "milk" }, checkedAt: Date.now() - 72 * 86400000 },
  { id: "sample-pasta", item: { id: 404, name: "Pasta", amount: 500, unit: "g", icon: "bread" }, checkedAt: Date.now() - 155 * 86400000 },
  { id: "sample-coffee", item: { id: 405, name: "Filterkaffee", amount: 1, unit: "kg", icon: "coffee" }, checkedAt: Date.now() - 68 * 86400000 },
  { id: "sample-apples", item: { id: 406, name: "Apfelmus", amount: 1, unit: "Stk", icon: "apple" }, checkedAt: Date.now() - 102 * 86400000 },
];
const productKey = (name: string) => name.trim().toLocaleLowerCase("de-DE");
function normalizeStepLinks(steps: RecipeStep[]): RecipeStep[] {
  const available = new Set<string>();
  return steps.map((step) => {
    const next = { ...step, ingredientAmounts: step.ingredientAmounts ? Object.fromEntries(Object.entries(step.ingredientAmounts).filter(([id]) => step.ingredientIds.includes(id))) : undefined, inputStepIds: (step.inputStepIds ?? []).filter((id) => available.has(id)) };
    if (step.output?.trim()) available.add(step.id);
    return next;
  });
}
function HighlightedInstruction({ text }: { text: string }) {
  const parts = text.split(/(\b(?:ca\.?\s*)?\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:Sekunden?|Sek\.?|Minuten?|Min\.?|Stunden?|Std\.?|h))(?=\s|[,.!?;:]|$)/gi);
  return <p>{parts.map((part, index) => index % 2 ? <mark className="recipe-time" key={index}>{part}</mark> : part)}</p>;
}
function RecipeImageCrop({ source, onCancel, onApply }: { source: string; onCancel: () => void; onApply: (image: string) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const viewport = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; position: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = source;
  }, [source]);
  const cropWidth = size.width && size.height ? Math.min(size.width, size.height * 0.75) / zoom : 0;
  const cropHeight = cropWidth / 0.75;
  const imageWidth = cropWidth ? size.width / cropWidth : 1;
  const imageHeight = cropHeight ? size.height / cropHeight : 1;
  function applyCrop() {
    if (!size.width || !size.height) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 600; canvas.height = 800;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, (size.width - cropWidth) * position.x, (size.height - cropHeight) * position.y, cropWidth, cropHeight, 0, 0, 600, 800);
      onApply(canvas.toDataURL("image/jpeg", 0.84));
    };
    image.src = source;
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}><DialogContent className="recipe-crop-dialog"><DialogHeader><DialogTitle>Rezeptfoto zuschneiden</DialogTitle><DialogDescription>Bild verschieben oder vergrößern, bis der Ausschnitt passt.</DialogDescription></DialogHeader><div ref={viewport} className="recipe-crop-viewport" onPointerDown={(event) => { if (event.button !== 0) return; drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { const current = drag.current; if (!current || current.pointerId !== event.pointerId || !viewport.current) return; const width = viewport.current.clientWidth; const height = viewport.current.clientHeight; setPosition({ x: imageWidth > 1 ? Math.max(0, Math.min(1, current.position.x - (event.clientX - current.x) / ((imageWidth - 1) * width))) : 0.5, y: imageHeight > 1 ? Math.max(0, Math.min(1, current.position.y - (event.clientY - current.y) / ((imageHeight - 1) * height))) : 0.5 }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><img src={source} alt="Bildausschnitt" draggable={false} style={{ width: `${imageWidth * 100}%`, height: `${imageHeight * 100}%`, left: `${(1 - imageWidth) * position.x * 100}%`, top: `${(1 - imageHeight) * position.y * 100}%` }} /></div><div className="recipe-crop-zoom"><Label htmlFor="recipe-crop-zoom">Vergrößern</Label><input id="recipe-crop-zoom" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></div><DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button><Button type="button" onClick={applyCrop} disabled={!size.width}>Ausschnitt übernehmen</Button></DialogFooter></DialogContent></Dialog>;
}
function suggestionScore(name: string, seed: number) {
  let hash = seed;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967295;
}
const initialRecipes: Recipe[] = [
  {
    id: "brioche", title: "Sonntags-Brioche", description: "Weich, buttrig und genau richtig für ein langes Frühstück.",
    categories: ["Brot", "Frühstück"], icon: "bread", image: "/recipe-brioche.png", minutes: 210, servings: 8,
    rating: 4, favorite: true, tryLater: false, prepared: 3, lastPrepared: "14.09.2026",
    ingredients: [
      { id: "flour", name: "Weizenmehl", detail: "500 g · Type 550", icon: "bread" },
      { id: "yeast", name: "Hefe", detail: "1 Päckchen · trocken", icon: "bread" },
      { id: "milk", name: "Milch", detail: "100 ml", icon: "milk", pantry: true },
      { id: "eggs", name: "Eier", detail: "3 Stück", icon: "bread" },
      { id: "almonds", name: "Mandelblättchen", detail: "2 EL", icon: "bread", optional: true },
    ],
    steps: [
      { id: "b1", text: "Mehl und Hefe mischen. Milch und Eier zugeben und alles zu einem geschmeidigen Teig kneten.", ingredientIds: ["flour", "yeast", "milk", "eggs"] },
      { id: "b2", text: "Den Teig abgedeckt gehen lassen, bis er sein Volumen deutlich vergrößert hat.", ingredientIds: [] },
      { id: "b3", text: "Teig formen, nach Wunsch mit Mandelblättchen bestreuen und goldbraun backen.", ingredientIds: ["almonds"] },
    ],
    variantGroups: [{ id: "dairy", title: "Milchprodukt", replaces: ["milk"], options: [
      { id: "milk", label: "100 ml Milch", ingredients: [{ id: "milk", name: "Milch", detail: "100 ml", icon: "milk", pantry: true }] },
      { id: "cream-milk", label: "50 ml Sahne + 50 ml Milch", ingredients: [{ id: "cream-half", name: "Sahne", detail: "50 ml", icon: "milk" }, { id: "milk-half", name: "Milch", detail: "50 ml", icon: "milk", pantry: true }] },
    ] }],
  },
  {
    id: "lentil", title: "Roter Linseneintopf", description: "Wärmend, würzig und in einer halben Stunde fertig.",
    categories: ["Herzhaft", "Vegetarisch"], icon: "pot", minutes: 30, servings: 4, rating: 5,
    favorite: true, tryLater: false, prepared: 8, lastPrepared: "20.09.2026",
    ingredients: [
      { id: "lentils", name: "Rote Linsen", detail: "250 g", icon: "bread" },
      { id: "carrots", name: "Karotten", detail: "3 Stück", icon: "carrot" },
      { id: "tomatoes", name: "Tomaten", detail: "1 Dose · gehackt", icon: "carrot" },
      { id: "cumin", name: "Kreuzkümmel", detail: "1 TL", icon: "bread", pantry: true },
    ],
    steps: [
      { id: "l1", text: "Karotten klein schneiden und mit Kreuzkümmel kurz anbraten.", ingredientIds: ["carrots", "cumin"] },
      { id: "l2", text: "Linsen und Tomaten zugeben. Mit Wasser aufgießen und köcheln lassen, bis die Linsen weich sind.", ingredientIds: ["lentils", "tomatoes"] },
    ],
  },
  {
    id: "gratin", title: "Kartoffelgratin", description: "Knusprig überbacken und innen herrlich cremig.",
    categories: ["Herzhaft", "Ofengericht"], icon: "pot", minutes: 70, servings: 4, rating: 4,
    favorite: false, tryLater: false, prepared: 5, lastPrepared: "02.09.2026",
    ingredients: [
      { id: "potatoes", name: "Kartoffeln", detail: "1 kg · festkochend", icon: "carrot" },
      { id: "cream", name: "Sahne", detail: "250 ml", icon: "milk" },
      { id: "cheese", name: "Bergkäse", detail: "150 g", icon: "milk" },
    ],
  },
  {
    id: "lemon", title: "Zitronenkuchen", description: "Saftig, frisch und unkompliziert aus der Kastenform.",
    categories: ["Kuchen", "Süß"], icon: "cake", minutes: 65, servings: 12, rating: 0,
    favorite: false, tryLater: true, prepared: 0,
    ingredients: [
      { id: "lemons", name: "Bio-Zitronen", detail: "2 Stück", icon: "apple" },
      { id: "flour", name: "Weizenmehl", detail: "250 g", icon: "bread" },
      { id: "butter", name: "Butter", detail: "200 g", icon: "milk" },
    ],
  },
];

const emptyRecipeDraft: RecipeDraft = { title: "", description: "", categories: [], minutes: null, servings: null, prepared: 0, ingredients: [], steps: [], versions: [] };

function madeCount(recipe: Recipe) { return recipe.prepared ?? (recipe.cooked ?? 0) + (recipe.baked ?? 0); }
function recipeSource(recipe: Recipe): { label: string; href?: string } {
  if (recipe.sourceUrl) {
    try {
      const url = new URL(recipe.sourceUrl);
      if (url.protocol === "https:" || url.protocol === "http:") return { label: url.hostname.replace(/^www\./i, ""), href: url.href };
    } catch { /* Ältere oder defekte lokale Quellenangaben nicht als Link öffnen. */ }
  }
  return { label: recipe.sourceType === "images" ? "Bilder" : recipe.sourceType === "pdf" ? "PDF" : recipe.sourceType === "text" ? "Text" : "Manuell" };
}
function RecipeSourceLine({ recipe }: { recipe: Recipe }) {
  const source = recipeSource(recipe);
  return <div className="recipe-source-line"><span>Quelle</span>{source.href ? <a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}<ExternalLink aria-hidden="true" /></a> : <strong>{source.label}</strong>}</div>;
}
function legacyVersions(recipe: Recipe): RecipeVersion[] {
  if (recipe.versions) return recipe.versions;
  return (recipe.variantGroups ?? []).flatMap((group) => group.options.slice(1).map((option) => {
    const ingredients = recipe.ingredients.filter((entry) => !group.replaces.includes(entry.id));
    const firstIndex = recipe.ingredients.findIndex((entry) => group.replaces.includes(entry.id));
    ingredients.splice(firstIndex < 0 ? ingredients.length : firstIndex, 0, ...option.ingredients);
    const steps = (recipe.steps ?? []).map((step) => ({ ...step, ingredientIds: step.ingredientIds.some((id) => group.replaces.includes(id)) ? [...step.ingredientIds.filter((id) => !group.replaces.includes(id)), ...option.ingredients.map((entry) => entry.id)] : [...step.ingredientIds] }));
    return { id: option.id, title: option.label || group.title, ingredients, steps };
  }));
}
function formatTaskDate(value?: string) {
  if (!value) return "Ohne Termin";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}
const defaultTaskLanes: TaskLane[] = [
  { id: "open", title: "Offen", color: "#7560df" }, { id: "doing", title: "In Arbeit", color: "#2f8b75" }, { id: "done", title: "Warten auf", color: "#d08a24" },
];
const laneColors = ["#7560df", "#2f8b75", "#d08a24", "#c1507c", "#397eb8", "#70727c"];

function itemDetail(item: ShoppingItem) {
  if (item.detail) return item.detail;
  const parts: string[] = [];
  if (item.amount) parts.push(`${item.amount.toLocaleString("de-DE")} ${item.unit ?? "Stk"}`);
  else if (item.weight) parts.push(`${item.weight.toLocaleString("de-DE")} ${item.unit ?? "g"}`);
  else if (item.count) parts.push(`${item.count.toLocaleString("de-DE")} Stk`);
  if (item.productType) parts.push(item.productType);
  return parts.join(" · ");
}
function recipeItemFromIngredient(ingredient: Ingredient, recipeTitle: string): ShoppingItem {
  const quantity = parseRecipeQuantity(ingredient.detail);
  return { id: 0, name: ingredient.name, amount: quantity.amount, unit: quantity.unit, productType: quantity.amount ? quantity.remainder || undefined : undefined, note: quantity.amount ? undefined : quantity.remainder || undefined, icon: getProductIcon(ingredient.name), source: recipeTitle };
}

const ProductIconContext = createContext<Record<string, ProductIcon | "auto">>({});
function ProductGlyph({ name, iconOverride, quiet = false }: { name: string; iconOverride?: ProductIcon | null; quiet?: boolean }) {
  const preferences = useContext(ProductIconContext);
  const preferred = preferences[productKey(name)];
  const icon = preferred === "auto" ? getProductIcon(name) : preferred ?? iconOverride ?? getProductIcon(name);
  const option = productIconCatalog.find((entry) => entry.icon === icon);
  const emoji = option && "emoji" in option ? option.emoji : null;
  const asset = option && "asset" in option ? option.asset : null;
  return <span className={`product-glyph product-glyph--${icon} product-glyph--emoji${quiet ? " product-glyph--quiet" : ""}`} data-group={option?.group} aria-hidden="true">{asset ? <img className="product-image" src={asset} alt="" /> : <span className="product-emoji">{emoji ?? "📦"}</span>}</span>;
}

function EditableProductGlyph({ name, onEdit }: { name: string; onEdit: () => void }) {
  const gesture = useRef<{ x: number; y: number; timer: number; fired: boolean } | null>(null);
  const suppressClick = useRef(false);
  return <button type="button" className="recipe-product-icon" aria-label={`Symbol für ${name} ändern`} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { if (event.button !== 0) return; const state = { x: event.clientX, y: event.clientY, timer: 0, fired: false }; gesture.current = state; state.timer = window.setTimeout(() => { if (gesture.current !== state) return; state.fired = true; suppressClick.current = true; onEdit(); }, 450); }} onPointerMove={(event) => { const current = gesture.current; if (current && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) { window.clearTimeout(current.timer); gesture.current = null; } }} onPointerUp={() => { const current = gesture.current; if (current) { window.clearTimeout(current.timer); if (current.fired) window.setTimeout(() => { suppressClick.current = false; }, 700); } gesture.current = null; }} onPointerCancel={() => { if (gesture.current) window.clearTimeout(gesture.current.timer); gesture.current = null; }} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onEdit(); }}><ProductGlyph name={name} quiet /></button>;
}

function StarRating({ value, onChange, compact = false }: { value: number; onChange?: (value: number) => void; compact?: boolean }) {
  return <div className={compact ? "star-rating star-rating--compact" : "star-rating"} aria-label={value ? `${value} von 5 Sternen` : "Noch nicht bewertet"}>
    {[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} disabled={!onChange} onClick={() => onChange?.(star)} aria-label={`${star} Sterne`}><Star className={star <= value ? "filled" : ""} /></button>)}
  </div>;
}

function SuggestionRow({ item, onAdd, onEdit }: { item: ShoppingItem; onAdd: (item: ShoppingItem) => void; onEdit: () => void }) {
  const touch = useRef<{ x: number; y: number; start: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  return <div className="suggestion-wrap"><button className="shopping-item shopping-item--suggestion" onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onAdd(item); }} type="button" aria-label={`${item.name}, zur Einkaufsliste hinzufügen`} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { if (event.pointerType === "touch" || (event.pointerType === "mouse" && event.button === 0)) touch.current = { x: event.clientX, y: event.clientY, start: Date.now(), moved: false }; }} onPointerMove={(event) => { if (touch.current && Math.hypot(event.clientX - touch.current.x, event.clientY - touch.current.y) > 8) touch.current.moved = true; }} onPointerCancel={() => { touch.current = null; }} onPointerUp={(event) => { const gesture = touch.current; touch.current = null; if (gesture && !gesture.moved && Date.now() - gesture.start >= 450) { event.preventDefault(); suppressClick.current = true; onEdit(); window.setTimeout(() => { suppressClick.current = false; }, 700); } }}>
    <ProductGlyph name={item.name} iconOverride={item.iconOverride} quiet />
    <span className="item-copy"><span className="item-title-row"><strong>{item.name}</strong></span><span className="item-detail">{itemDetail(item) || "Ohne Mengenangabe"}</span></span>
  </button><button className="suggestion-edit" type="button" onClick={onEdit} aria-label={`${item.name} bearbeiten`}><Pencil /></button></div>;
}

function RecipeIngredientTile({ ingredient, item, selected, listMatch, onToggle, onEdit }: { ingredient: Ingredient; item?: ShoppingItem; selected: boolean; listMatch?: ShoppingNameMatch | null; onToggle: () => void; onEdit: () => void }) {
  const warning = listMatch?.kind === "exact" ? "Schon auf Liste" : listMatch ? `Bereits ähnlich auf der Liste: ${listMatch.name}` : "";
  return <div className="recipe-shopping-tile-wrap"><button type="button" className={`shopping-item recipe-shopping-tile ${selected ? "recipe-shopping-tile--selected" : "shopping-item--suggestion"} ${listMatch ? "recipe-shopping-tile--duplicate" : ""}`} onClick={onToggle} aria-label={`${ingredient.name} ${selected ? "aus Auswahl entfernen" : "zum Einkauf auswählen"}${warning ? `, ${warning}` : ""}`} aria-pressed={selected}>
    <ProductGlyph name={item?.name ?? ingredient.name} iconOverride={item?.iconOverride} quiet={!selected} />
    <span className="recipe-tile-action" aria-hidden="true">{selected ? <Check /> : <Plus />}</span>
    <span className="item-copy"><span className="item-title-row"><strong>{item?.name ?? ingredient.name}</strong></span><span className="item-detail">{item ? [itemDetail(item), item.note].filter(Boolean).join(" · ") || "Ohne Mengenangabe" : ingredient.detail || "Ohne Mengenangabe"}</span>{warning && <span className="recipe-tile-warning"><CircleAlert /><span>{warning}</span></span>}</span>
  </button><button className="recipe-tile-edit" type="button" onClick={onEdit} aria-label={`${ingredient.name} vor dem Übertragen bearbeiten`}><Pencil /></button></div>;
}

function ShoppingRow({ item, isNew, onComplete, onEdit, onMove, dragging, dropPosition, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: { item: ShoppingItem; isNew?: boolean; onComplete: () => void; onEdit: () => void; onMove: (direction: -1 | 1) => void; dragging?: boolean; dropPosition?: "before" | "after"; onPointerDown: (event: React.PointerEvent<HTMLElement>) => void; onPointerMove: (event: React.PointerEvent<HTMLElement>) => void; onPointerUp: (event: React.PointerEvent<HTMLElement>) => void; onPointerCancel: () => void }) {
  return <article data-shopping-id={item.id} className={`shopping-item ${isNew ? "shopping-item--new" : ""} ${dragging ? "is-dragging" : ""} ${dropPosition ? `drop-${dropPosition}` : ""}`} role="button" tabIndex={0} aria-label={`${item.name}${isNew ? ", neu" : ""} abhaken`} aria-description="Mit Alt und Pfeiltasten verschieben" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown" onClick={onComplete} onContextMenu={(event) => event.preventDefault()} onKeyDown={(event) => { if (event.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); onMove(event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1); } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onComplete(); } }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
    <ProductGlyph name={item.name} iconOverride={item.iconOverride} />
    <div className="item-copy"><div className="item-title-row"><h2>{item.name}</h2>{item.source && <span className="recipe-source">{item.source}</span>}</div><p>{itemDetail(item)}{item.note && <span>{itemDetail(item) ? " · " : ""}{item.note}</span>}</p></div>
    {isNew && <span className="shopping-ribbon" aria-hidden="true"><span>Neu</span></span>}
    <Button className="shopping-edit" variant="ghost" size="icon" aria-label={`${item.name} bearbeiten`} onClick={(event) => { event.stopPropagation(); onEdit(); }} onKeyDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}><Pencil /></Button>
  </article>;
}

function Shelf({ title, count, children, open, onOpenChange }: { title: string; count: number; children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return <Collapsible className="shelf" open={open} onOpenChange={onOpenChange}><CollapsibleTrigger className="shelf-trigger"><span>{title}</span><span className="shelf-meta">{count}</span><ChevronDown className="shelf-chevron" /></CollapsibleTrigger><CollapsibleContent className="shelf-content">{children}</CollapsibleContent></Collapsible>;
}

function HomeActivity({ state, kind, prefix, label }: { state: NoticeState; kind: PreviewKind; prefix: string; label: string }) {
  const section = kind === "new-item" || kind === "purchased" ? state.shopping : state.tasks;
  const count = section.filter((key) => key.startsWith(`${prefix}:`)).length;
  if (!count) return null;
  const names = noticePreviews(state, kind).map((entry) => entry.label).join(" · ");
  return <span className={`home-activity home-activity--${kind}`}><span className="home-activity-label">{label} {count}</span>{names && <span className="home-activity-names" title={names}>{names}</span>}</span>;
}

function AppNav({ view, setView, counts }: { view: View; setView: (view: View) => void; counts: Record<"shopping" | "recipes" | "tasks", number> }) {
  const badge = (section: "shopping" | "recipes" | "tasks") => counts[section] > 0 ? <span className="nav-badge" aria-label={`${counts[section]} Neuigkeiten`}>{counts[section] > 99 ? "99+" : counts[section]}</span> : null;
  return <>
    <aside className="side-rail">
      <button className="brand-mark" onClick={() => setView("home")} aria-label="Nuzzle – zur Startseite"><HouseHeart /></button>
      <nav aria-label="Hauptnavigation">
        <button className={`rail-link ${view === "home" ? "rail-link--active" : ""}`} onClick={() => setView("home")} type="button"><HouseHeart /><span>Home</span></button>
        <button className={`rail-link ${view === "shopping" ? "rail-link--active" : ""}`} onClick={() => setView("shopping")} type="button"><ShoppingBasket /><span>Einkaufen</span>{badge("shopping")}</button>
        <button className={`rail-link ${view === "recipes" ? "rail-link--active" : ""}`} onClick={() => setView("recipes")} type="button"><BookOpen /><span>Rezepte</span>{badge("recipes")}</button>
        <button className={`rail-link ${view === "tasks" ? "rail-link--active" : ""}`} onClick={() => setView("tasks")} type="button"><ClipboardCheck /><span>Aufgaben</span>{badge("tasks")}</button>
      </nav>
    </aside>
    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <button className={view === "home" ? "active" : ""} onClick={() => setView("home")} type="button"><HouseHeart /><span>Home</span></button>
      <button className={view === "shopping" ? "active" : ""} onClick={() => setView("shopping")} type="button"><ShoppingBasket /><span>Einkaufen</span>{badge("shopping")}</button>
      <button className={view === "recipes" ? "active" : ""} onClick={() => setView("recipes")} type="button"><BookOpen /><span>Rezepte</span>{badge("recipes")}</button>
      <button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")} type="button"><ClipboardCheck /><span>Aufgaben</span>{badge("tasks")}</button>
    </nav>
  </>;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [items, setItems] = useState(initialItems);
  const [recent, setRecent] = useState(seedRecent);
  const [recipeRecent, setRecipeRecent] = useState<ShoppingItem[]>([]);
  const [pantry, setPantry] = useState(initialPantry);
  const [pantryDialog, setPantryDialog] = useState(false);
  const [pantryName, setPantryName] = useState("");
  const [purchaseHistory, setPurchaseHistory] = useState(seedPurchaseHistory);
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const lastPurchaseId = useRef<string | null>(null);
  const lastCompletedShelfId = useRef<number | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [shoppingDropTarget, setShoppingDropTarget] = useState<ShoppingDropTarget | null>(null);
  const shoppingPointer = useRef<{ itemId: number; pointerId: number; x: number; y: number; dragging: boolean; touch: boolean; scrolling: boolean; held: boolean; moved: boolean; lastY: number; timer?: number } | null>(null);
  const shoppingDragPoint = useRef<{ x: number; y: number } | null>(null);
  const shoppingScrollFrame = useRef<number | null>(null);
  const suppressShoppingClick = useRef(false);
  const [recipes, setRecipes] = useState<Recipe[]>(() => initialRecipes.map((recipe) => ({ ...recipe, versions: legacyVersions(recipe) })));
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [tasks, setTasks] = useState<HouseholdTask[]>(initialTasks);
  const [taskLanes, setTaskLanes] = useState<TaskLane[]>(defaultTaskLanes);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskStatus, setTaskStatus] = useState("open");
  const [taskAssignee, setTaskAssignee] = useState<HouseholdTask["assignee"]>("Gemeinsam");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("");
  const [taskReminderMinutes, setTaskReminderMinutes] = useState(0);
  const [reminderNow, setReminderNow] = useState(0);
  const [taskPriority, setTaskPriority] = useState<HouseholdTask["priority"]>();
  const [taskImages, setTaskImages] = useState<string[]>([]);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [readTaskComments, setReadTaskComments] = useState<Record<string, string[]>>({});
  const [commentText, setCommentText] = useState("");
  const [commentAuthor, setCommentAuthor] = useState<CommentAuthor | null>(null);
  const [identityChecking, setIdentityChecking] = useState(true);
  const [lastTaskDone, setLastTaskDone] = useState<HouseholdTask | null>(null);
  const [taskCelebration, setTaskCelebration] = useState(0);
  const [taskArchiveOpen, setTaskArchiveOpen] = useState(false);
  const [taskNote, setTaskNote] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskDialog, setTaskDialog] = useState(false);
  const taskBaseline = useRef<HouseholdTask | null>(null);
  const [laneDialog, setLaneDialog] = useState(false);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [laneTitle, setLaneTitle] = useState("");
  const [laneColor, setLaneColor] = useState(laneColors[0]);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null);
  const taskPointer = useRef<{ taskId: number; pointerId: number; x: number; y: number; dragging: boolean; touch: boolean; scrolling: boolean; lastY: number; lastTime: number; velocity: number; timer?: number } | null>(null);
  const taskInertiaFrame = useRef<number | null>(null);
  useEffect(() => () => { if (taskInertiaFrame.current !== null) window.cancelAnimationFrame(taskInertiaFrame.current); taskInertiaFrame.current = null; }, [view]);
  const dragPoint = useRef<{ x: number; y: number } | null>(null);
  const dragScrollFrame = useRef<number | null>(null);
  const taskBoardRef = useRef<HTMLDivElement | null>(null);
  const suppressTaskClick = useRef(false);
  const categoryStripRef = useRef<HTMLDivElement | null>(null);
  const categoryPointer = useRef<{ pointerId: number; x: number; scrollLeft: number; dragging: boolean } | null>(null);
  const suppressCategoryClick = useRef(false);
  const [taskView, setTaskView] = useState<TaskView>("board");
  const [openShelves, setOpenShelves] = useState<Record<string, boolean>>({ recent: false, recipeRecent: false, frequent: false, pantry: false, taskDone: false });
  const [ready, setReady] = useState(false);
  const [syncDialog, setSyncDialog] = useState(false);
  const [checkingDetail, setCheckingDetail] = useState(false);
  const detailRequest = useRef(0);
  const [queries, setQueries] = useState({ shopping: "", recipes: "" });
  const [category, setCategory] = useState("Alle");
  const [recipeSort, setRecipeSort] = useState<RecipeSort>("chronological");
  const [introducedRecipeIds, setIntroducedRecipeIds] = useState<string[]>([]);
  const [visitRecipeIds, setVisitRecipeIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<ShoppingSort>("custom");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [recipeImageOpen, setRecipeImageOpen] = useState(false);
  const [recipeServingsOverride, setRecipeServingsOverride] = useState<number | null>(null);
  const [viewedRecipeIds, setViewedRecipeIds] = useState<string[]>([]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [lastDone, setLastDone] = useState<ShoppingItem | null>(null);
  const [lastDeleted, setLastDeleted] = useState<ShoppingItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [iconDialog, setIconDialog] = useState(false);
  const [iconCategory, setIconCategory] = useState<(typeof productIconGroups)[number] | "Alle">("Alle");
  const [itemIconOverride, setItemIconOverride] = useState<ProductIcon | null>(null);
  const [iconSelectionChanged, setIconSelectionChanged] = useState(false);
  const [iconTargetName, setIconTargetName] = useState<string | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const importRequest = useRef(0);
  const importAbort = useRef<AbortController | null>(null);
  const [shoppingDialog, setShoppingDialog] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<SuggestionTarget | null>(null);
  const [editingRecipeIngredientId, setEditingRecipeIngredientId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [itemAmount, setItemAmount] = useState("1");
  const [itemUnit, setItemUnit] = useState<ShoppingUnit>("Stk");
  const [itemType, setItemType] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [itemPantryOverride, setItemPantryOverride] = useState<boolean | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [pendingRecipeItems, setPendingRecipeItems] = useState<Record<string, ShoppingItem>>({});
  const [openRecipeShelves, setOpenRecipeShelves] = useState({ optional: true, pantry: false, skipped: false });
  const [celebration, setCelebration] = useState(false);
  const [recipeEditor, setRecipeEditor] = useState(false);
  const [editorSections, setEditorSections] = useState({ versions: false, ingredients: true, steps: true });
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [sourceRecipeImage, setSourceRecipeImage] = useState<string | null>(null);
  const [deleteRecipeDialog, setDeleteRecipeDialog] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(emptyRecipeDraft);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientAmount, setIngredientAmount] = useState("");
  const [ingredientUnit, setIngredientUnit] = useState<ShoppingUnit>("Stk");
  const [ingredientDetail, setIngredientDetail] = useState("");
  const [ingredientOptional, setIngredientOptional] = useState(false);
  const [ingredientPantry, setIngredientPantry] = useState(false);
  const [stepText, setStepText] = useState("");
  const [stepIngredientIds, setStepIngredientIds] = useState<string[]>([]);
  const [stepOutput, setStepOutput] = useState("");
  const [stepInputStepIds, setStepInputStepIds] = useState<string[]>([]);
  const [importText, setImportText] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");

  const push = usePushNotifications(ready);
  useEffect(() => {
    if (!ready) return;
    const tick = () => setReminderNow(Date.now());
    tick(); const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [ready]);

  const navigation: AppNavigation = { view, taskView, selectedRecipeId, recipeImageOpen, itemDialog, iconDialog, taskDialog, laneDialog, importDialog, shoppingDialog, recipeEditor, categoryDialog, pantryDialog, syncDialog, deleteRecipeDialog, cropSource };
  useAppBack(ready, navigation, (target) => {
    setView(target.view as View); setTaskView(target.taskView as TaskView);
    setSelectedRecipeId(target.selectedRecipeId); setRecipeImageOpen(target.recipeImageOpen); setItemDialog(target.itemDialog);
    setIconDialog(target.iconDialog); if (taskDialog && !target.taskDialog) saveTask(); else setTaskDialog(target.taskDialog);
    setLaneDialog(target.laneDialog); if (!target.importDialog && importDialog) closeImportDialog(); else setImportDialog(target.importDialog);
    setShoppingDialog(target.shoppingDialog); setRecipeEditor(target.recipeEditor);
    setCategoryDialog(target.categoryDialog); setPantryDialog(target.pantryDialog);
    setSyncDialog(target.syncDialog); setDeleteRecipeDialog(target.deleteRecipeDialog);
    setCropSource(target.cropSource);
  });

  useEffect(() => {
    setIngredientPantry(isPantryIngredient(ingredientName, pantry.map((item) => item.name)));
  }, [ingredientName, pantry]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setIdentityChecking(true);
    fetch("/api/household-identity", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? await response.json() as { author?: unknown } : null)
      .then((result: { author?: unknown } | null) => setCommentAuthor(result?.author === "Markus" || result?.author === "Bettina" ? result.author : null))
      .catch(() => { if (!controller.signal.aborted) setCommentAuthor(null); })
      .finally(() => { if (!controller.signal.aborted) setIdentityChecking(false); });
    return () => controller.abort();
  }, [ready, taskDialog]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("nest-local-v1");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.items) setItems(data.items);
        if (data.recent) {
          setRecent(data.recent);
        }
        if (data.recipeRecent) setRecipeRecent(data.recipeRecent);
        if (data.pantry) setPantry(data.pantry);
        if (data.purchaseHistory) setPurchaseHistory(data.purchaseHistory);
        if (data.recipes) setRecipes(data.recipes.map((recipe: Recipe) => {
          const seed = initialRecipes.find((entry) => entry.id === recipe.id);
          const restored = { ...recipe, variantGroups: recipe.variantGroups ?? seed?.variantGroups, steps: (recipe.steps ?? seed?.steps ?? []).map((step) => step.id === "b1" && step.text === "Mehl und Hefe mischen. Milch, Eier und Butter zugeben und alles zu einem geschmeidigen Teig kneten." ? { ...step, text: initialRecipes[0].steps![0].text } : step) };
          return { ...restored, versions: legacyVersions(restored) };
        }));
        if (data.customCategories) setCustomCategories(data.customCategories);
        if (data.tasks) setTasks(data.tasks.map((task: HouseholdTask) => ({ ...task, status: task.status ?? (task.done ? "done" : "open"), assignee: task.assignee ?? "Gemeinsam" })));
        if (data.taskLanes?.length) setTaskLanes(data.taskLanes.map((lane: TaskLane, index: number) => ({ ...lane, title: lane.title === "Erledigt" ? "Warten auf" : lane.title, color: lane.color ?? laneColors[index % laneColors.length] })));
        if (data.ui) {
          if (["alphabetical", "chronological"].includes(data.ui.recipeSort)) setRecipeSort(data.ui.recipeSort);
          if (Array.isArray(data.ui.introducedRecipeIds)) setIntroducedRecipeIds(data.ui.introducedRecipeIds.filter((id: unknown) => typeof id === "string"));
          if (Array.isArray(data.ui.viewedRecipeIds)) setViewedRecipeIds(data.ui.viewedRecipeIds.filter((id: unknown) => typeof id === "string"));
          if (data.ui.readTaskComments && typeof data.ui.readTaskComments === "object" && !Array.isArray(data.ui.readTaskComments)) setReadTaskComments(Object.fromEntries(Object.entries(data.ui.readTaskComments).filter(([, ids]) => Array.isArray(ids) && ids.every((id) => typeof id === "string"))) as Record<string, string[]> );
          if (["home", "shopping", "recipes", "tasks", "settings"].includes(data.ui.view)) setView(data.ui.view);
          if (data.ui.queries) setQueries((current) => ({ ...current, ...data.ui.queries }));
          if (typeof data.ui.category === "string") setCategory(data.ui.category);
          if (["custom", "alphabetical", "chronological"].includes(data.ui.sortMode)) setSortMode(data.ui.sortMode);
          else if (typeof data.ui.sortAlpha === "boolean") setSortMode(data.ui.sortAlpha ? "alphabetical" : "custom");
          if (data.ui.taskView === "board" || data.ui.taskView === "calendar") setTaskView(data.ui.taskView);
          if (data.ui.openShelves) setOpenShelves((current) => ({ ...current, ...data.ui.openShelves }));
          if (data.ui.editorSections) setEditorSections((current) => ({ ...current, ...data.ui.editorSections }));
        }
      }
    } catch { /* Defekte lokale Vorschau startet mit sicheren Beispieldaten. */ }
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "tasks" || requestedView === "shopping") setView(requestedView);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const ui = { view, queries, category, recipeSort, introducedRecipeIds, sortMode, taskView, openShelves, editorSections, readTaskComments, viewedRecipeIds };
    window.localStorage.setItem("nest-local-v1", JSON.stringify({ items, recent, recipeRecent, pantry, purchaseHistory, recipes, customCategories, tasks, taskLanes, ui }));
  }, [ready, items, recent, recipeRecent, pantry, purchaseHistory, recipes, customCategories, tasks, taskLanes, view, queries, category, recipeSort, introducedRecipeIds, sortMode, taskView, openShelves, editorSections, readTaskComments, viewedRecipeIds]);
  useEffect(() => {
    if (!lastDone && !lastDeleted && !lastTaskDone && !notice) return;
    const timeout = window.setTimeout(() => { setLastDone(null); setLastDeleted(null); setLastTaskDone(null); setNotice(null); }, 4200);
    return () => window.clearTimeout(timeout);
  }, [lastDone, lastDeleted, lastTaskDone, notice]);
  useEffect(() => {
    if (!celebration) return;
    const timeout = window.setTimeout(() => setCelebration(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [celebration]);
  useEffect(() => { if (ready) window.scrollTo({ top: 0, behavior: "auto" }); }, [ready, view]);
  useEffect(() => { if (ready && view === "shopping") setSuggestionSeed(Math.floor(Math.random() * 2147483647)); }, [ready, view]);
  useEffect(() => { setRecipeServingsOverride(null); }, [selectedRecipeId]);
  useEffect(() => { setRecipeImageOpen(false); }, [selectedRecipeId]);

  useEffect(() => {
    if (!ready) return;
    if (view !== "recipes") { setVisitRecipeIds([]); return; }
    const fresh = unfamiliarRecipeIds(recipes, [...introducedRecipeIds, ...viewedRecipeIds], commentAuthor);
    if (fresh.length) {
      setVisitRecipeIds((current) => [...new Set([...current, ...fresh])]);
      setIntroducedRecipeIds((current) => [...new Set([...current, ...fresh])]);
    }
  }, [ready, view, recipes, commentAuthor, introducedRecipeIds, viewedRecipeIds]);

  const sharedData: HouseholdData = { items, recent, recipeRecent, pantry, purchaseHistory, recipes, customCategories, tasks, taskLanes };
  const productIcons = Object.fromEntries(recent.filter((item) => item.iconPreference).map((item) => [productKey(item.name), item.iconOverride ?? "auto"])) as Record<string, ProductIcon | "auto">;
  const notices = useHouseholdNotices();
  const lastNoticeView = useRef<View | null>(null);
  const sync = useHouseholdSync(ready, sharedData, (data) => {
    setItems(data.items as ShoppingItem[]);
    setRecent(data.recent as ShoppingItem[]);
    setRecipeRecent(data.recipeRecent as ShoppingItem[]);
    setPantry(data.pantry as ShoppingItem[]);
    setPurchaseHistory(data.purchaseHistory as PurchaseRecord[]);
    setRecipes(data.recipes as Recipe[]);
    setCustomCategories(data.customCategories as string[]);
    setTasks(data.tasks as HouseholdTask[]);
    setTaskLanes(data.taskLanes as TaskLane[]);
  }, (before, after) => {
    setRecipes((current) => applyImageReplacements(current, before.recipes, after.recipes) as Recipe[]);
    setTasks((current) => applyTaskImageReplacements(current, before.tasks, after.tasks) as HouseholdTask[]);
  }, taskDialog || itemDialog || laneDialog || categoryDialog || recipeEditor || shoppingDialog || pantryDialog, (base, local, remote, author) => { notices.receive(base, local, remote, author); if (view === "shopping") notices.markShoppingSeen(); });
  useEffect(() => { if (ready && view !== "home" && view !== "settings") notices.acknowledge(view); }, [ready, view, notices.acknowledge]);
  useEffect(() => { if (!ready) return; if (view === "shopping" && lastNoticeView.current !== "shopping") notices.visitShopping(); lastNoticeView.current = view; }, [ready, view, notices.visitShopping]);
  useEffect(() => { if (ready) void sync.refresh(); }, [ready, view, selectedRecipeId, sync.refresh]);
  function downloadSyncLog() {
    try {
      const log = syncLog.snapshot();
      const blob = new Blob([JSON.stringify({ format: "nest-sync-log-v1", exportedAt: new Date().toISOString(), ...log }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "nuzzle-sync-protokoll.json"; link.click();
      URL.revokeObjectURL(url);
      if (!log.persistent) showNotice("Das Protokoll konnte nicht dauerhaft auf diesem Gerät gespeichert werden.");
    } catch { showNotice("Das Sync-Protokoll konnte nicht heruntergeladen werden."); }
  }
  async function downloadLocalBackup() {
    try {
      const portableRecipes = [];
      for (const recipe of recipes) {
        if (!imageIdFromPath(recipe.image)) { portableRecipes.push(recipe); continue; }
        const response = await fetch(recipe.image!, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("Ein Rezeptbild konnte nicht geladen werden.");
        const imageBlob = await response.blob();
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Ein Rezeptbild konnte nicht gelesen werden."));
          reader.readAsDataURL(imageBlob);
        });
        portableRecipes.push({ ...recipe, image: content });
      }
      const portableTasks = await Promise.all(tasks.map(async (task) => ({ ...task, images: await Promise.all((task.images ?? []).map(async (image) => {
        if (!imageIdFromPath(image)) return image;
        const response = await fetch(image, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("Ein Aufgabenbild konnte nicht geladen werden.");
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden.")); reader.readAsDataURL(blob); });
      })) })));
      const blob = new Blob([JSON.stringify({ ...sharedData, recipes: portableRecipes, tasks: portableTasks, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "nuzzle-sicherung.json"; link.click();
      URL.revokeObjectURL(url);
    } catch { showNotice("Sicherung nicht erstellt: Ein Bild ist nicht erreichbar."); }
  }
  async function loadLocalBackup(file?: File) {
    if (!file) return;
    if (file.size > 50_000_000) { showNotice("Die Sicherung ist größer als 50 MB."); return; }
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      const data = parseHouseholdData(Object.fromEntries(householdKeys.map((key) => [key, raw[key]])), 50_000_000);
      if (!data) throw new Error("Ungültige Sicherung");
      if (!window.confirm("Daten aus dieser Sicherung auf diesem Gerät laden? Die bisherigen lokalen Daten werden vorher gesichert.")) return;
      const original = window.localStorage.getItem("nest-local-v1");
      if (original) window.localStorage.setItem("nest-backup-" + Date.now(), original);
      const restoredRecipes = [];
      for (const entry of data.recipes as Recipe[]) {
        if (!isEmbeddedImage(entry.image)) { restoredRecipes.push(entry); continue; }
        const response = await fetch("/api/household-image", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: entry.image }) });
        if (!response.ok) throw new Error("Ein Bild konnte nicht übernommen werden.");
        const result = await response.json() as { path?: string };
        if (!imageIdFromPath(result.path)) throw new Error("Ungültige Bildantwort.");
        restoredRecipes.push({ ...entry, image: result.path });
      }
      data.recipes = restoredRecipes;
      data.tasks = await Promise.all((data.tasks as HouseholdTask[]).map(async (task) => ({ ...task, images: await Promise.all((task.images ?? []).map(async (image) => {
        if (!isEmbeddedImage(image)) return image;
        const response = await fetch("/api/household-image", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: image }) });
        if (!response.ok) throw new Error("Ein Bild konnte nicht übernommen werden.");
        const result = await response.json() as { path?: string };
        if (!imageIdFromPath(result.path)) throw new Error("Ungültige Bildantwort.");
        return result.path!;
      })) })));
      if (!parseHouseholdData(data)) throw new Error("Die Haushaltsdaten sind zu groß.");
      setItems(data.items as ShoppingItem[]); setRecent(data.recent as ShoppingItem[]);
      setRecipeRecent(data.recipeRecent as ShoppingItem[]); setPantry(data.pantry as ShoppingItem[]);
      setPurchaseHistory(data.purchaseHistory as PurchaseRecord[]); setRecipes(data.recipes as Recipe[]);
      setCustomCategories(data.customCategories as string[]); setTasks(data.tasks as HouseholdTask[]);
      setTaskLanes(data.taskLanes as TaskLane[]);
      showNotice("Sicherung geladen. Du kannst sie jetzt gemeinsam speichern.");
    } catch { showNotice("Sicherung konnte nicht geladen werden. Die bisherigen Daten bleiben erhalten."); }
  }
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null;
  const selectedVersions = selectedRecipe?.versions?.filter((version) => selectedVersionIds.includes(version.id)) ?? [];
  const combinedRecipe = selectedRecipe ? combineRecipeVersions(selectedRecipe.ingredients, selectedRecipe.steps ?? [], selectedVersions) : null;
  const baseServings = selectedRecipe?.servings && selectedRecipe.servings > 0 ? selectedRecipe.servings : null;
  const shownServings = recipeServingsOverride ?? baseServings;
  const servingFactor = baseServings && shownServings ? shownServings / baseServings : 1;
  const recipeIngredients = (combinedRecipe?.ingredients ?? []).map((ingredient) => ({ ...ingredient, detail: scaleIngredientDetail(ingredient.detail, servingFactor) }));
  const recipeSteps = combinedRecipe?.steps ?? [];
  const recipeShoppingIngredients = recipeIngredients;
  const activeDraftVersion = recipeDraft.versions.find((version) => version.id === editingVersionId);
  const draftIngredients = activeDraftVersion?.ingredients ?? recipeDraft.ingredients;
  const draftSteps = activeDraftVersion?.steps ?? recipeDraft.steps;
  const chosenRecipeIngredients = recipeShoppingIngredients.filter((ingredient) => selectedIngredients.includes(ingredient.id));
  const optionalRecipeIngredients = recipeShoppingIngredients.filter((ingredient) => !selectedIngredients.includes(ingredient.id) && ingredient.optional);
  const pantryRecipeIngredients = recipeShoppingIngredients.filter((ingredient) => !selectedIngredients.includes(ingredient.id) && !ingredient.optional && ingredient.pantry);
  const skippedRecipeIngredients = recipeShoppingIngredients.filter((ingredient) => !selectedIngredients.includes(ingredient.id) && !ingredient.optional && !ingredient.pantry);
  const shoppingNameMatch = (ingredient: Ingredient) => findShoppingNameMatch(pendingRecipeItems[ingredient.id]?.name ?? ingredient.name, items.map((item) => item.name));
  const query = view === "recipes" ? queries.recipes : queries.shopping;
  const categories = useMemo(() => [...new Set(["Alle", "Lieblingsrezepte", ...recipes.flatMap((recipe) => recipe.categories), ...customCategories])], [recipes, customCategories]);
  const visibleRecipes = useMemo(() => sortRecipes(recipes.filter((recipe) => {
    const matchesQuery = `${recipe.title} ${recipe.description} ${recipe.categories.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "Alle" || (category === "Lieblingsrezepte" && recipe.favorite) || recipe.categories.includes(category);
    return matchesQuery && matchesCategory;
  }), recipeSort), [recipes, query, category, recipeSort]);
  const recentSuggestions = [...recent, ...recipeRecent].filter((item) => item.frequentTemplateId === undefined && item.frequentKey === undefined && !item.iconPreference);
  const frequent = useMemo(() => frequentPurchases(purchaseHistory), [purchaseHistory]);
  const recentGroups = groupRecentPurchases(recentSuggestions, Math.max(reminderNow, Date.now()));
  const recipeGroups = [
    { label: "Neu", recipes: visibleRecipes.filter((recipe) => visitRecipeIds.includes(recipe.id)) },
    { label: visitRecipeIds.length ? "Weitere Rezepte" : "", recipes: visibleRecipes.filter((recipe) => !visitRecipeIds.includes(recipe.id)) },
  ];
  const sortedItems = useMemo(() => sortShopping(items, sortMode), [items, sortMode]);
  const rediscover = useMemo(() => {
    const onList = new Set(items.map((item) => productKey(item.name)));
    const newest = new Map<string, PurchaseRecord>();
    purchaseHistory.forEach((record) => {
      const key = productKey(record.item.name);
      if (!newest.has(key) || newest.get(key)!.checkedAt < record.checkedAt) newest.set(key, record);
    });
    const cutoff = Date.now() - 45 * 86400000;
    return [...newest.values()].filter((record) => record.checkedAt < cutoff && !onList.has(productKey(record.item.name)))
      .sort((a, b) => suggestionScore(a.item.name, suggestionSeed) - suggestionScore(b.item.name, suggestionSeed)).slice(0, 4);
  }, [items, purchaseHistory, suggestionSeed]);

  function shoppingTargetFromPoint(x: number, y: number): ShoppingDropTarget | null {
    const element = document.elementFromPoint(x, y);
    const card = element?.closest<HTMLElement>("[data-shopping-id]");
    if (!card?.dataset.shoppingId) return null;
    const rect = card.getBoundingClientRect();
    const horizontalIntent = Math.abs(x - (rect.left + rect.width / 2)) > Math.abs(y - (rect.top + rect.height / 2));
    return { itemId: Number(card.dataset.shoppingId), position: horizontalIntent ? (x < rect.left + rect.width / 2 ? "before" : "after") : (y < rect.top + rect.height / 2 ? "before" : "after") };
  }
  function reorderShoppingItem(itemId: number, target: ShoppingDropTarget) {
    setItems((current) => {
      const visualOrder = [...sortShopping(current, sortMode)];
      const dragged = visualOrder.find((item) => item.id === itemId); if (!dragged) return current;
      const remaining = visualOrder.filter((item) => item.id !== itemId);
      const targetIndex = target.itemId === null ? remaining.length : remaining.findIndex((item) => item.id === target.itemId);
      const insertAt = target.itemId === null || targetIndex < 0 ? remaining.length : targetIndex + (target.position === "after" ? 1 : 0);
      remaining.splice(insertAt, 0, dragged);
      return remaining;
    });
    setSortMode("custom");
  }
  function finishShoppingDrag(itemId: number | null, target: ShoppingDropTarget | null) {
    if (itemId !== null && target && target.itemId !== itemId) reorderShoppingItem(itemId, target);
    if (shoppingScrollFrame.current !== null) window.cancelAnimationFrame(shoppingScrollFrame.current);
    shoppingScrollFrame.current = null; shoppingDragPoint.current = null; shoppingPointer.current = null;
    setDraggingItemId(null); setShoppingDropTarget(null);
  }
  function startShoppingAutoScroll() {
    if (shoppingScrollFrame.current !== null) return;
    const tick = () => {
      const point = shoppingDragPoint.current;
      if (!point) { shoppingScrollFrame.current = null; return; }
      const edge = 105;
      const amount = point.y < edge ? -Math.ceil((edge - point.y) / 7) : point.y > window.innerHeight - edge ? Math.ceil((point.y - (window.innerHeight - edge)) / 7) : 0;
      if (amount) { window.scrollBy(0, amount); setShoppingDropTarget(shoppingTargetFromPoint(point.x, point.y)); }
      shoppingScrollFrame.current = window.requestAnimationFrame(tick);
    };
    shoppingScrollFrame.current = window.requestAnimationFrame(tick);
  }

  function completeItem(item: ShoppingItem) {
    const historyId = crypto.randomUUID();
    const purchasedAt = Date.now();
    const shelfId = purchasedAt + Math.random();
    lastPurchaseId.current = historyId;
    lastCompletedShelfId.current = shelfId;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setRecent((current) => [{ ...item, id: shelfId, lastPurchasedAt: purchasedAt }, ...current]);
    setPurchaseHistory((current) => [...current, { id: historyId, item, checkedAt: purchasedAt, actor: commentAuthor ?? undefined }]);
    setLastDone(item); setLastDeleted(null); setLastTaskDone(null); setNotice(null);
  }
  function undoComplete() {
    if (!lastDone) return;
    const historyId = lastPurchaseId.current;
    const shelfId = lastCompletedShelfId.current;
    setPurchaseHistory((current) => current.filter((record) => record.id !== historyId));
    lastPurchaseId.current = null;
    setRecipeRecent((current) => current.filter((entry) => entry.id !== shelfId));
    setRecent((current) => current.filter((entry) => entry.id !== shelfId));
    lastCompletedShelfId.current = null;
    setItems((current) => [lastDone, ...current]); setLastDone(null);
  }
  function showNotice(message: string) { setLastDone(null); setLastDeleted(null); setLastTaskDone(null); setNotice(message); }
  function addSuggestion(item: ShoppingItem) { const product = { ...item }; delete product.frequentTemplateId; delete product.frequentKey; delete product.source; delete product.lastPurchasedAt; const now = Date.now(); setItems((current) => [...current, { ...product, id: now, addedAt: now, createdBy: commentAuthor ?? undefined, icon: item.iconOverride ?? getProductIcon(item.name) }]); showNotice(`${item.name} hinzugefügt`); }
  function moveRecentToList(item: ShoppingItem) {
    setRecipeRecent((current) => current.filter((entry) => entry.id !== item.id));
    setRecent((current) => current.filter((entry) => entry.id !== item.id));
    const now = Date.now(); setItems((current) => [...current, { ...item, source: undefined, lastPurchasedAt: undefined, id: now, addedAt: now, createdBy: commentAuthor ?? undefined, icon: item.iconOverride ?? getProductIcon(item.name) }]);
    showNotice(`${item.name} zurück auf der Liste`);
  }
  function openItemEditor(item?: ShoppingItem) {
    setEditingRecipeIngredientId(null);
    setEditingSuggestion(null);
    setItemPantryOverride(null);
    const legacy = item?.detail ?? "";
    const parsed = parseRecipeQuantity(legacy);
    const legacyAmount = item?.amount ?? item?.weight ?? item?.count ?? parsed.amount;
    setEditingItemId(item?.id ?? null); setName(item?.name ?? ""); setItemAmount(legacyAmount !== undefined ? String(legacyAmount).replace(".", ",") : item?.source ? "" : "1");
    setItemUnit(item?.unit ?? parsed.unit ?? "Stk"); setItemType(item?.productType ?? (parsed.amount ? parsed.remainder : "")); setItemNote(item?.note ?? (!parsed.amount ? parsed.remainder : ""));
    const preferred = item ? productIcons[productKey(item.name)] : undefined;
    setItemIconOverride(preferred === "auto" ? null : preferred ?? item?.iconOverride ?? null); setIconSelectionChanged(false); setIconTargetName(null); setIconDialog(false);
    setItemDialog(true);
  }
  async function openFreshItemEditor(item: ShoppingItem) {
    const request = ++detailRequest.current;
    setCheckingDetail(true);
    const latest = await sync.refresh();
    if (request !== detailRequest.current) return;
    setCheckingDetail(false);
    const fresh = latest ? (latest.items as ShoppingItem[]).find((entry) => entry.id === item.id) : item;
    if (!fresh) { showNotice("Dieser Posten wurde auf einem anderen Gerät entfernt."); return; }
    openItemEditor(fresh);
  }
  function openSuggestionEditor(target: SuggestionTarget) {
    openItemEditor(target.item);
    setEditingSuggestion(target);
  }
  function openRecipeItemEditor(ingredient: Ingredient) {
    if (!selectedRecipe) return;
    openItemEditor(pendingRecipeItems[ingredient.id] ?? recipeItemFromIngredient(ingredient, selectedRecipe.title));
    setEditingRecipeIngredientId(ingredient.id);
  }
  function rememberProductIcon(name: string, icon: ProductIcon | null) {
    const key = productKey(name); if (!key) return;
    setRecent((current) => { const existing = current.find((item) => item.iconPreference && productKey(item.name) === key); const preference: ShoppingItem = { id: existing?.id ?? Date.now() + Math.random(), name: key, icon: icon ?? getProductIcon(name), iconOverride: icon ?? undefined, iconPreference: true }; return existing ? current.map((item) => item.id === existing.id ? preference : item) : [...current, preference]; });
  }
  function openRecipeProductIcon(name: string) { setIconTargetName(name); setIconCategory("Alle"); const preferred = productIcons[productKey(name)]; setItemIconOverride(preferred && preferred !== "auto" ? preferred : null); setIconDialog(true); }
  function selectProductIcon(icon: ProductIcon | null) { if (iconTargetName) { rememberProductIcon(iconTargetName, icon); setIconTargetName(null); } else { setItemIconOverride(icon); setIconSelectionChanged(true); } setIconDialog(false); }
  function saveItem() {
    if (!name.trim() || (itemAmount.trim() && parsePositiveAmount(itemAmount) === null)) return;
    if (iconSelectionChanged) rememberProductIcon(name, itemIconOverride);
    const previous = editingSuggestion?.item ?? items.find((item) => item.id === editingItemId);
    const recipeItem = editingRecipeIngredientId ? pendingRecipeItems[editingRecipeIngredientId] : undefined;
    const next: ShoppingItem = { id: editingRecipeIngredientId ? recipeItem?.id ?? 0 : editingItemId ?? Date.now(), addedAt: editingItemId === null && !editingRecipeIngredientId ? Date.now() : previous?.addedAt, createdBy: editingItemId === null && !editingRecipeIngredientId ? commentAuthor ?? undefined : previous?.createdBy, lastPurchasedAt: editingSuggestion ? previous?.lastPurchasedAt : undefined, name: name.trim(), amount: parsePositiveAmount(itemAmount) ?? undefined, unit: itemUnit, productType: itemType.trim() || undefined, note: itemNote.trim() || undefined, icon: itemIconOverride ?? getProductIcon(name), iconOverride: itemIconOverride ?? undefined, source: recipeItem?.source ?? previous?.source };
    if (editingRecipeIngredientId) { setPendingRecipeItems((current) => ({ ...current, [editingRecipeIngredientId]: next })); setItemDialog(false); return; }
    if (editingSuggestion?.kind === "pantry") {
      setPantry((current) => itemPantryOverride === false ? current.filter((entry) => entry.id !== editingSuggestion.id) : current.map((entry) => entry.id === editingSuggestion.id ? { ...next, id: entry.id } : entry));
      setItemDialog(false); showNotice("Änderungen gespeichert"); return;
    }
    const pantryId = Date.now() + Math.random();
    if (itemPantryOverride !== null) setPantry((current) => {
      const matching = current.some((entry) => productKey(entry.name) === productKey(next.name));
      if (itemPantryOverride && !matching) return [...current, { id: pantryId, name: next.name, icon: next.icon, iconOverride: next.iconOverride }];
      if (!itemPantryOverride && matching) return current.filter((entry) => productKey(entry.name) !== productKey(next.name));
      return current;
    });
    if (editingSuggestion?.kind === "recent") setRecent((current) => current.map((item) => item.id === editingSuggestion.id ? { ...next, id: item.id } : item));
    else if (editingSuggestion?.kind === "recipeRecent") setRecipeRecent((current) => current.map((item) => item.id === editingSuggestion.id ? { ...next, id: item.id } : item));
    else if (editingSuggestion?.kind === "history") setPurchaseHistory((current) => current.map((record) => record.id === editingSuggestion.id ? { ...record, item: next } : record));
    else if (editingSuggestion?.kind === "frequent") setRecent((current) => { const override = { ...next, frequentKey: String(editingSuggestion.id) }; return current.some((entry) => entry.frequentKey === override.frequentKey) ? current.map((entry) => entry.frequentKey === override.frequentKey ? { ...override, id: entry.id } : entry) : [...current, { ...override, id: pantryId }]; });
    else setItems((current) => editingItemId === null ? [...current, next] : current.map((item) => item.id === editingItemId ? next : item));
    setItemDialog(false); showNotice(editingItemId === null ? "Posten hinzugefügt" : "Änderungen gespeichert");
  }
  function deleteItem() {
    const item = items.find((entry) => entry.id === editingItemId); if (!item) return;
    setItems((current) => current.filter((entry) => entry.id !== item.id)); setItemDialog(false); setLastDeleted(item); setLastDone(null); setLastTaskDone(null); setNotice(null);
  }
  function undoDelete() {
    if (!lastDeleted) return; setItems((current) => [lastDeleted, ...current]); setLastDeleted(null);
  }
  function patchRecipe(recipeId: string, patch: Partial<Recipe>) { setRecipes((current) => current.map((recipe) => recipe.id === recipeId ? { ...recipe, ...patch } : recipe)); }
  function markPrepared() {
    if (!selectedRecipe) return;
    patchRecipe(selectedRecipe.id, { prepared: madeCount(selectedRecipe) + 1, cooked: undefined, baked: undefined, lastPrepared: "heute" });
    setCelebration(true); showNotice(`${selectedRecipe.title} geschafft – großartig!`);
  }
  function openShoppingSelection() {
    if (!selectedRecipe) return;
    setSelectedIngredients(recipeIngredients.filter((ingredient) => !ingredient.pantry && !ingredient.optional).map((ingredient) => ingredient.id));
    setPendingRecipeItems(Object.fromEntries(recipeIngredients.map((ingredient) => [ingredient.id, recipeItemFromIngredient(ingredient, selectedRecipe.title)])));
    setShoppingDialog(true);
  }
  function chooseRecipeVersion(versionId: string | null) {
    if (!selectedRecipe) return;
    const ids = versionId === null ? [] : selectedVersionIds.includes(versionId) ? selectedVersionIds.filter((id) => id !== versionId) : [...selectedVersionIds, versionId];
    const versions = selectedRecipe.versions?.filter((version) => ids.includes(version.id)) ?? [];
    const result = combineRecipeVersions(selectedRecipe.ingredients, selectedRecipe.steps ?? [], versions);
    const nextIds = result.compatible ? ids : versionId ? [versionId] : [];
    const nextRecipe = result.compatible ? result : combineRecipeVersions(selectedRecipe.ingredients, selectedRecipe.steps ?? [], selectedRecipe.versions?.filter((version) => nextIds.includes(version.id)) ?? []);
    if (!result.compatible) showNotice("Diese Varianten ändern dieselbe Zutat oder denselben Schritt. Zur gewählten Variante gewechselt.");
    setSelectedVersionIds(nextIds);
    setSelectedIngredients(nextRecipe.ingredients.filter((ingredient) => !ingredient.pantry && !ingredient.optional).map((ingredient) => ingredient.id));
    setPendingRecipeItems(Object.fromEntries(nextRecipe.ingredients.map((ingredient) => [ingredient.id, recipeItemFromIngredient({ ...ingredient, detail: scaleIngredientDetail(ingredient.detail, servingFactor) }, selectedRecipe.title)])));
  }
  function toggleRecipeIngredient(id: string) {
    setSelectedIngredients((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }
  function addRecipeIngredients() {
    if (!selectedRecipe) return;
    const additions: ShoppingItem[] = recipeShoppingIngredients.filter((ingredient) => selectedIngredients.includes(ingredient.id)).map((ingredient, index) => ({
      ...(pendingRecipeItems[ingredient.id] ?? recipeItemFromIngredient(ingredient, selectedRecipe.title)), id: Date.now() + index, addedAt: Date.now() + index, createdBy: commentAuthor ?? undefined,
    }));
    setItems((current) => [...current, ...additions]); setShoppingDialog(false); setSelectedRecipeId(null); setView("shopping"); setNotice(`${additions.length} Zutaten hinzugefügt`);
  }
  function createCategory() {
    const clean = newCategory.trim(); if (!clean) return;
    setCustomCategories((current) => current.includes(clean) ? current : [...current, clean]); setCategory(clean); setNewCategory(""); setCategoryDialog(false);
  }
  function addDraftCategory() {
    const clean = newCategory.trim(); if (!clean) return;
    setCustomCategories((current) => current.includes(clean) ? current : [...current, clean]);
    setRecipeDraft((current) => ({ ...current, categories: current.categories.includes(clean) ? current.categories : [...current.categories, clean] }));
    setNewCategory("");
  }
  function addPantryProduct() {
    const clean = pantryName.trim();
    if (!clean || pantry.some((item) => productKey(item.name) === productKey(clean))) return;
    setPantry((current) => [...current, { id: Date.now(), name: clean, icon: getProductIcon(clean) }]);
    setPantryName("");
  }
  function closeImportDialog() {
    importRequest.current += 1;
    importAbort.current?.abort();
    importAbort.current = null;
    setImportDialog(false);
  }
  function openImportDialog() {
    importRequest.current += 1;
    importAbort.current?.abort();
    importAbort.current = null;
    setImportText(""); setImportUrl(""); setImportFiles([]); setImportError(""); setImportBusy(false);
    setImportDialog(true);
  }
  function openRecipeEditor(recipe?: Recipe) {
    setSourceRecipeImage(null);
    setRecipeDraft(recipe ? { id: recipe.id, title: recipe.title, description: recipe.description, categories: [...recipe.categories], minutes: recipe.minutes ?? null, servings: recipe.servings ?? null, prepared: madeCount(recipe), ingredients: [...recipe.ingredients], steps: [...(recipe.steps ?? [])], versions: legacyVersions(recipe), image: recipe.image, sourceUrl: recipe.sourceUrl, sourceType: recipe.sourceType } : { ...emptyRecipeDraft, categories: [], ingredients: [], steps: [], versions: [], sourceType: "manual" });
    setEditingVersionId(recipe && selectedVersionIds.length === 1 ? selectedVersionIds[0] : null);
    resetIngredientEntry(); setStepText(""); setStepIngredientIds([]); setStepOutput(""); setStepInputStepIds([]); closeImportDialog(); setSelectedRecipeId(null); setRecipeEditor(true);
  }
  function updateDraftContent(change: (ingredients: Ingredient[], steps: RecipeStep[]) => { ingredients: Ingredient[]; steps: RecipeStep[] }) {
    setRecipeDraft((current) => {
      if (!editingVersionId) return { ...current, ...change(current.ingredients, current.steps) };
      return { ...current, versions: current.versions.map((version) => version.id === editingVersionId ? { ...version, ...change(version.ingredients, version.steps) } : version) };
    });
  }
  function switchDraftVersion(id: string | null) {
    setEditingVersionId(id);
    resetIngredientEntry(); setStepText(""); setStepIngredientIds([]); setStepOutput(""); setStepInputStepIds([]);
  }
  function addDraftVersion() {
    const id = crypto.randomUUID();
    setRecipeDraft((current) => ({ ...current, versions: [...current.versions, { id, title: `Variante ${current.versions.length + 1}`, ingredients: current.ingredients.map((ingredient) => ({ ...ingredient })), steps: current.steps.map((step) => ({ ...step, ingredientIds: [...step.ingredientIds], inputStepIds: [...(step.inputStepIds ?? [])] })) }] }));
    switchDraftVersion(id);
  }
  function resetIngredientEntry() {
    setEditingIngredientId(null); setIngredientName(""); setIngredientAmount(""); setIngredientUnit("Stk"); setIngredientDetail(""); setIngredientOptional(false); setIngredientPantry(false);
  }
  function editDraftIngredient(ingredient: Ingredient) {
    const quantity = parseRecipeQuantity(ingredient.detail);
    setEditingIngredientId(ingredient.id); setIngredientName(ingredient.name); setIngredientAmount(quantity.amount !== undefined ? String(quantity.amount).replace(".", ",") : ""); setIngredientUnit(quantity.unit ?? "Stk"); setIngredientDetail(quantity.remainder);
    setIngredientOptional(Boolean(ingredient.optional)); setIngredientPantry(Boolean(ingredient.pantry));
    requestAnimationFrame(() => document.getElementById("recipe-ingredient-entry")?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }
  function addDraftIngredient() {
    if (!ingredientName.trim() || (ingredientAmount.trim() && parsePositiveAmount(ingredientAmount) === null)) return;
    const amount = parsePositiveAmount(ingredientAmount) ?? undefined;
    const ingredient: Ingredient = { id: editingIngredientId ?? crypto.randomUUID(), name: ingredientName.trim(), detail: formatRecipeQuantity(amount, ingredientUnit, ingredientDetail.trim() || (amount ? "" : "nach Bedarf")), icon: getProductIcon(ingredientName), optional: ingredientOptional || undefined, pantry: ingredientPantry || undefined };
    updateDraftContent((ingredients, steps) => ({ ingredients: editingIngredientId ? ingredients.map((entry) => entry.id === editingIngredientId ? ingredient : entry) : [...ingredients, ingredient], steps }));
    resetIngredientEntry();
  }
  function addDraftStep() {
    if (!stepText.trim()) return;
    updateDraftContent((ingredients, steps) => ({ ingredients, steps: [...steps, { id: crypto.randomUUID(), text: stepText.trim(), ingredientIds: stepIngredientIds, output: stepOutput.trim() || undefined, inputStepIds: stepInputStepIds }] }));
    setStepText(""); setStepIngredientIds([]); setStepOutput(""); setStepInputStepIds([]);
  }
  function moveDraftStep(index: number, direction: -1 | 1) {
    updateDraftContent((ingredients, currentSteps) => {
      const steps = [...currentSteps]; const target = index + direction;
      if (target < 0 || target >= steps.length) return { ingredients, steps };
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ingredients, steps: normalizeStepLinks(steps) };
    });
  }
  function saveRecipe() {
    if (!recipeDraft.title.trim() || (editingIngredientId && (!ingredientName.trim() || Boolean(ingredientAmount.trim() && parsePositiveAmount(ingredientAmount) === null)))) return;
    const previous = recipes.find((recipe) => recipe.id === recipeDraft.id);
    const pendingIngredient = (entry: Ingredient) => entry.id === editingIngredientId ? { ...entry, name: ingredientName.trim(), detail: formatRecipeQuantity(parsePositiveAmount(ingredientAmount) ?? undefined, ingredientUnit, ingredientDetail.trim() || (ingredientAmount.trim() ? "" : "nach Bedarf")), icon: getProductIcon(ingredientName), optional: ingredientOptional || undefined, pantry: ingredientPantry || undefined } : entry;
    const ingredients = editingIngredientId && !editingVersionId ? recipeDraft.ingredients.map(pendingIngredient) : recipeDraft.ingredients;
    const versions = recipeDraft.versions.map((version) => ({ ...version, title: version.title.trim() || "Variante", ingredients: editingIngredientId && editingVersionId === version.id ? version.ingredients.map(pendingIngredient) : version.ingredients, steps: normalizeStepLinks(version.steps) }));
    const next: Recipe = { id: recipeDraft.id ?? `${Date.now()}`, createdBy: recipeDraft.id ? previous?.createdBy : commentAuthor ?? undefined, createdAt: previous?.createdAt ?? (previous ? undefined : Date.now()), title: recipeDraft.title.trim(), description: recipeDraft.description.trim(), categories: recipeDraft.categories, minutes: recipeDraft.minutes, servings: recipeDraft.servings, ingredients, steps: normalizeStepLinks(recipeDraft.steps), versions, image: recipeDraft.image, sourceUrl: recipeDraft.sourceUrl, sourceType: recipeDraft.sourceType ?? "manual", icon: previous?.icon ?? "pot", rating: previous?.rating ?? 0, favorite: previous?.favorite ?? false, tryLater: previous?.tryLater ?? true, prepared: recipeDraft.prepared, lastPrepared: previous?.lastPrepared };
    setRecipes((current) => previous ? current.map((recipe) => recipe.id === previous.id ? next : recipe) : [next, ...current]);
    resetIngredientEntry(); setRecipeEditor(false); showNotice(previous ? "Rezept aktualisiert" : "Rezept angelegt");
  }
  function deleteRecipe() {
    if (!recipeDraft.id) return;
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeDraft.id));
    setSelectedRecipeId(null); setDeleteRecipeDialog(false); setRecipeEditor(false); showNotice("Rezept gelöscht");
  }
  function loadRecipeImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20_000_000) { showNotice("Bitte ein Bild bis 20 MB wählen"); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSource(String(reader.result));
    reader.readAsDataURL(file);
  }
  async function importRecipe() {
    if (!importText.trim() && !importUrl.trim() && importFiles.length === 0) return;
    const request = ++importRequest.current;
    const controller = new AbortController();
    importAbort.current = controller;
    setImportBusy(true); setImportError("");
    try {
      const pastedUrl = /^https?:\/\/\S+$/i.test(importText.trim()) && !importUrl.trim() ? importText.trim() : "";
      const url = importUrl.trim() || pastedUrl;
      const importMimeType = (file: File) => file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "");
      if (importFiles.length > 4 || importFiles.some((file) => !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(importMimeType(file))) || importFiles.reduce((sum, file) => sum + file.size, 0) > 7_000_000) throw new Error("Bitte höchstens vier Bilder oder PDFs mit zusammen maximal 7 MB wählen.");
      const images = await Promise.all(importFiles.map(async (file) => ({ mimeType: importMimeType(file), data: (await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden.")); reader.readAsDataURL(file); })).split(",")[1] })));
      if (request !== importRequest.current) return;
      const response = await fetch("/api/recipe-import", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: pastedUrl ? "" : importText.trim(), url, images }) });
      const result = await response.json() as { error?: string; recipe: unknown; sourceUrl?: string; sourceImage?: string | null };
      if (request !== importRequest.current) return;
      if (!response.ok) throw new Error(result.error || "Das Rezept konnte nicht erkannt werden.");
      type RawIngredient = { name: string; detail: string; optional: boolean };
      type RawStep = { text: string; ingredientIndexes: number[]; ingredientAmounts?: { ingredientIndex: number; detail: string }[]; output?: string; inputStepIndexes?: number[] };
      const raw = result.recipe as { title: string; description: string; minutes: number | null; servings: number | null; categories: string[]; ingredients: RawIngredient[]; steps: RawStep[]; versions?: { title: string; ingredients: RawIngredient[]; steps: RawStep[] }[]; variants?: { title: string; replacesIngredientIndexes: number[]; alternatives: { label: string; ingredients: RawIngredient[] }[] }[] };
      const pantryNames = pantry.map((item) => item.name);
      const mapIngredients = (entries: RawIngredient[]): Ingredient[] => entries.map((entry) => ({ id: crypto.randomUUID(), name: entry.name, detail: entry.detail, icon: getProductIcon(entry.name), optional: entry.optional || undefined, pantry: isPantryIngredient(entry.name, pantryNames) || undefined }));
      const mapSteps = (entries: RawStep[], ingredientList: Ingredient[]): RecipeStep[] => {
        const ids = entries.map(() => crypto.randomUUID());
        return entries.map((entry, index) => ({ id: ids[index], text: entry.text, ingredientIds: entry.ingredientIndexes.map((ingredientIndex) => ingredientList[ingredientIndex]?.id).filter((id): id is string => Boolean(id)), ingredientAmounts: Object.fromEntries((entry.ingredientAmounts ?? []).filter((amount) => ingredientList[amount.ingredientIndex]).map((amount) => [ingredientList[amount.ingredientIndex].id, amount.detail])), output: entry.output?.trim() || undefined, inputStepIds: (entry.inputStepIndexes ?? []).filter((stepIndex) => stepIndex >= 0 && stepIndex < index).map((stepIndex) => ids[stepIndex]) }));
      };
      const ingredients = mapIngredients(raw.ingredients);
      const steps = mapSteps(raw.steps, ingredients);
      const versions: RecipeVersion[] = (raw.versions ?? []).map((entry) => {
        const versionIngredients = mapIngredients(entry.ingredients);
        return { id: crypto.randomUUID(), title: entry.title, ingredients: versionIngredients, steps: mapSteps(entry.steps, versionIngredients) };
      });
      for (const group of raw.variants ?? []) for (const alternative of group.alternatives) {
        const replacementIds = new Set(group.replacesIngredientIndexes.map((index) => ingredients[index]?.id));
        const alternatives = mapIngredients(alternative.ingredients);
        const singleReplacement = replacementIds.size === 1 && alternatives.length === 1;
        const versionIngredients = singleReplacement ? ingredients.map((ingredient) => replacementIds.has(ingredient.id) ? { ...alternatives[0], id: ingredient.id } : ingredient) : [...ingredients.filter((ingredient) => !replacementIds.has(ingredient.id)), ...alternatives];
        const versionSteps = singleReplacement ? steps.map((step) => ({ ...step, ingredientAmounts: step.ingredientAmounts ? Object.fromEntries(Object.entries(step.ingredientAmounts).filter(([id]) => !replacementIds.has(id))) : undefined, ingredientIds: [...step.ingredientIds] })) : steps.map((step) => ({ ...step, ingredientAmounts: step.ingredientAmounts ? Object.fromEntries(Object.entries(step.ingredientAmounts).filter(([id]) => !replacementIds.has(id))) : undefined, ingredientIds: step.ingredientIds.some((id) => replacementIds.has(id)) ? [...step.ingredientIds.filter((id) => !replacementIds.has(id)), ...alternatives.map((ingredient) => ingredient.id)] : [...step.ingredientIds] }));
        versions.push({ id: crypto.randomUUID(), title: alternative.label || group.title, ingredients: versionIngredients, steps: versionSteps });
      }
      setRecipeDraft({ title: raw.title, description: raw.description, minutes: raw.minutes, servings: raw.servings, categories: raw.categories, prepared: 0, ingredients, steps, versions, sourceUrl: result.sourceUrl, sourceType: url ? undefined : importFiles.some((file) => importMimeType(file) === "application/pdf") ? "pdf" : importFiles.length > 0 ? "images" : "text" });
      setSourceRecipeImage(result.sourceImage ?? null);
      switchDraftVersion(null); setImportDialog(false); setRecipeEditor(true);
      setImportFiles([]); setImportText(""); setImportUrl("");
    } catch (error) { if (request === importRequest.current) setImportError(error instanceof Error ? error.message : "Import fehlgeschlagen."); }
    finally { if (request === importRequest.current) { importAbort.current = null; setImportBusy(false); } }
  }
  async function openTaskEditor(task?: HouseholdTask, laneId?: string) {
    const request = ++detailRequest.current;
    if (task) {
      setCheckingDetail(true);
      const latest = await sync.refresh();
      if (request !== detailRequest.current) return;
      setCheckingDetail(false);
      const fresh = latest ? (latest.tasks as HouseholdTask[]).find((entry) => entry.id === task!.id) : task;
      if (!fresh) { showNotice("Diese Aufgabe wurde auf einem anderen Gerät entfernt."); return; }
      task = fresh;
    } else setCheckingDetail(false);
    if (task?.comments?.length) markTaskCommentsRead(task.id, task.comments);
    setIdentityChecking(true);
    taskBaseline.current = task ?? null;
    setEditingTaskId(task?.id ?? null); setTaskTitle(task?.title ?? ""); setTaskStatus(task?.status ?? laneId ?? taskLanes[0]?.id ?? "open");
    setTaskAssignee(taskPerson(task?.assignee)); setTaskDueDate(task?.dueDate ?? ""); setTaskDueTime(task?.dueTime ?? ""); setTaskReminderMinutes(task?.reminderMinutes ?? 0); setTaskNote(task?.description ?? task?.note ?? "");
    setTaskPriority(task?.priority); setTaskImages(task?.images ?? []); setTaskComments(task?.comments ?? []); setCommentText(""); setTaskDialog(true);
  }
  function markTaskCommentsRead(taskId: number, comments: TaskComment[]) {
    if (comments.length) setReadTaskComments((current) => ({ ...current, [taskId]: mergeReadCommentIds(current[taskId], comments) }));
  }
  function saveTask() {
    const previous = tasks.find((task) => task.id === editingTaskId);
    const title = taskTitle.trim() || previous?.title;
    if (!title) { setTaskDialog(false); return; }
    if (taskDueDate && taskDueAt({ dueDate: taskDueDate, dueTime: taskDueTime || undefined }) === null) { showNotice("Bitte einen gültigen Termin wählen. Diese Uhrzeit existiert bei der Zeitumstellung nicht."); return; }
    const pendingComment = commentText.trim() && commentAuthor ? { id: crypto.randomUUID(), author: commentAuthor, text: commentText.trim(), createdAt: new Date().toISOString(), pushEligible: true } : null;
    const imageAuthors = taskImages.map((image) => { const index = taskBaseline.current?.images?.indexOf(image) ?? -1; return index >= 0 ? taskBaseline.current?.imageAuthors?.[index] ?? null : commentAuthor; });
    const fields = { title, status: taskStatus, assignee: taskAssignee, dueDate: taskDueDate || undefined, dueTime: taskDueDate ? taskDueTime || undefined : undefined, reminderMinutes: taskReminderMinutes, description: taskNote.trim() || undefined, note: undefined, priority: taskPriority, images: taskImages, imageAuthors, comments: pendingComment ? [...taskComments, pendingComment] : taskComments };
    const id = editingTaskId ?? Date.now();
    markTaskCommentsRead(id, fields.comments);
    if (editingTaskId !== null && taskBaseline.current && !taskDraftChanged(taskBaseline.current, fields)) { setTaskDialog(false); return; }
    setTasks((current) => editingTaskId === null ? [{ id, ...fields, createdAt: Date.now(), createdBy: commentAuthor ?? undefined }, ...current] : current.map((task) => task.id === editingTaskId ? { ...task, ...fields } : task));
    setTaskDialog(false); if (editingTaskId === null) showNotice("Aufgabe hinzugefügt");
  }
  function completeTask(task: HouseholdTask) {
    const completedAt = new Date().toISOString();
    setTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, done: true, completedAt, completedBy: commentAuthor ?? undefined } : entry));
    setTaskDialog(false); setLastDone(null); setLastDeleted(null); setNotice(null); setLastTaskDone(task); setTaskCelebration((value) => value + 1);
  }
  function restoreTask(task: HouseholdTask) {
    const { status, newLane } = resolveRestoreLane(task.status, taskLanes, `unknown-${Date.now()}`, laneColors[5]);
    if (newLane) setTaskLanes((current) => [...current, newLane]);
    setTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, status, done: false, completedAt: undefined } : entry));
    setLastTaskDone(null);
  }
  function addTaskComment() {
    const text = commentText.trim(); if (!text || !commentAuthor || identityChecking) return;
    const comment = { id: crypto.randomUUID(), author: commentAuthor, text, createdAt: new Date().toISOString(), pushEligible: true };
    setTaskComments((current) => [...current, comment]);
    setCommentText("");
  }
  function loadTaskImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 20_000_000) { showNotice("Bitte ein Bild bis 20 MB wählen"); return; }
    const reader = new FileReader();
    reader.onerror = () => showNotice("Bild konnte nicht gelesen werden");
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => showNotice("Bild konnte nicht gelesen werden");
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d"); if (!context) { showNotice("Bild konnte nicht verarbeitet werden"); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setTaskImages((current) => [...current, canvas.toDataURL("image/jpeg", 0.78)]);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }
  function reorderTask(taskId: number, target: TaskDropTarget) {
    setTasks((current) => {
      const dragged = current.find((task) => task.id === taskId); if (!dragged) return current;
      const remaining = current.filter((task) => task.id !== taskId);
      const laneTasks = remaining.filter((task) => task.status === target.laneId);
      const targetIndex = target.taskId === null ? laneTasks.length : laneTasks.findIndex((task) => task.id === target.taskId);
      const insertAt = target.taskId === null || targetIndex < 0 ? laneTasks.length : targetIndex + (target.position === "after" ? 1 : 0);
      laneTasks.splice(insertAt, 0, { ...dragged, status: target.laneId });
      const orderedLaneIds = new Set(taskLanes.map((lane) => lane.id));
      const result: HouseholdTask[] = [];
      taskLanes.forEach((lane) => result.push(...(lane.id === target.laneId ? laneTasks : remaining.filter((task) => task.status === lane.id))));
      result.push(...remaining.filter((task) => !orderedLaneIds.has(task.status)));
      return result;
    });
  }
  function finishTaskDrag(taskId: number | null, target: TaskDropTarget | null) {
    if (taskId !== null && target && target.taskId !== taskId) reorderTask(taskId, target);
    if (dragScrollFrame.current !== null) window.cancelAnimationFrame(dragScrollFrame.current);
    dragScrollFrame.current = null; dragPoint.current = null;
    setDraggingTaskId(null); setDropTarget(null); taskPointer.current = null;
  }
  function continueTaskScroll(velocity: number) {
    if (Math.abs(velocity) < .05 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(32, now - previous); previous = now;
      window.scrollBy(0, velocity * elapsed);
      velocity *= Math.pow(.93, elapsed / 16);
      if (Math.abs(velocity) > .025) taskInertiaFrame.current = window.requestAnimationFrame(tick);
      else taskInertiaFrame.current = null;
    };
    taskInertiaFrame.current = window.requestAnimationFrame(tick);
  }
  function startTaskAutoScroll() {
    if (dragScrollFrame.current !== null) return;
    const tick = () => {
      const point = dragPoint.current;
      if (!point) { dragScrollFrame.current = null; return; }
      const edge = 110;
      const amount = point.y < edge ? -Math.ceil((edge - point.y) / 7) : point.y > window.innerHeight - edge ? Math.ceil((point.y - (window.innerHeight - edge)) / 7) : 0;
      if (amount) { window.scrollBy(0, amount); setDropTarget(targetFromPoint(point.x, point.y)); }
      const board = taskBoardRef.current;
      if (board && board.scrollWidth > board.clientWidth) {
        const rect = board.getBoundingClientRect();
        if (point.y >= rect.top && point.y <= rect.bottom) {
          const scrollEdge = 80;
          const horizontal = point.x < rect.left + scrollEdge ? -Math.ceil((rect.left + scrollEdge - point.x) / 5) : point.x > rect.right - scrollEdge ? Math.ceil((point.x - (rect.right - scrollEdge)) / 5) : 0;
          if (horizontal) { board.scrollLeft += horizontal; setDropTarget(targetFromPoint(point.x, point.y)); }
        }
      }
      dragScrollFrame.current = window.requestAnimationFrame(tick);
    };
    dragScrollFrame.current = window.requestAnimationFrame(tick);
  }
  function targetFromPoint(x: number, y: number): TaskDropTarget | null {
    const element = document.elementFromPoint(x, y);
    const lane = element?.closest<HTMLElement>("[data-lane-id]"); if (!lane?.dataset.laneId) return null;
    const card = element?.closest<HTMLElement>("[data-task-id]");
    if (!card?.dataset.taskId) return { laneId: lane.dataset.laneId, taskId: null, position: "after" };
    const rect = card.getBoundingClientRect();
    return { laneId: lane.dataset.laneId, taskId: Number(card.dataset.taskId), position: y < rect.top + rect.height / 2 ? "before" : "after" };
  }
  function openLaneEditor(lane?: TaskLane) {
    setEditingLaneId(lane?.id ?? null); setLaneTitle(lane?.title ?? ""); setLaneColor(lane?.color ?? laneColors[taskLanes.length % laneColors.length]); setLaneDialog(true);
  }
  function saveLaneTitle() {
    const title = laneTitle.trim(); if (!title) return;
    if (editingLaneId) setTaskLanes((current) => current.map((lane) => lane.id === editingLaneId ? { ...lane, title, color: laneColor } : lane));
    else setTaskLanes((current) => [...current, { id: `lane-${Date.now()}`, title, color: laneColor }]);
    setLaneDialog(false); showNotice(editingLaneId ? "Bereich aktualisiert" : "Bereich hinzugefügt");
  }
  function moveLane(laneId: string, offset: -1 | 1) {
    setTaskLanes((current) => {
      const index = current.findIndex((lane) => lane.id === laneId);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const reordered = [...current];
      const [lane] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, lane);
      return reordered;
    });
  }
  function deleteLane() {
    if (!editingLaneId || taskLanes.length < 2) return;
    const fallback = taskLanes.find((lane) => lane.id !== editingLaneId); if (!fallback) return;
    setTasks((current) => current.map((task) => task.status === editingLaneId && !task.done ? { ...task, status: fallback.id } : task));
    setTaskLanes((current) => current.filter((lane) => lane.id !== editingLaneId)); setLaneDialog(false); showNotice("Bereich gelöscht");
  }
  function deleteTask() {
    if (editingTaskId === null) return;
    setTasks((current) => current.filter((task) => task.id !== editingTaskId)); setTaskDialog(false); showNotice("Aufgabe gelöscht");
  }

  if (!ready) return <main className="app-boot" role="status" aria-label="Nuzzle wird geladen"><NuzzleLoadingMark /><span>Nuzzle</span></main>;

  return <ProductIconContext.Provider value={productIcons}><main className="app-shell">
    <AppNav view={view} setView={(next) => { if (next !== "home" && next !== "settings") notices.acknowledge(next); setView(next); }} counts={{ shopping: notices.state.shopping.length, recipes: notices.state.recipes.length, tasks: notices.state.tasks.length }} />
    <section className="main-surface">
      <header className="topbar">
        <button className="wordmark" onClick={() => setView("home")} type="button"><span className="wordmark-dot" />Nuzzle</button>
        {(view === "shopping" || view === "recipes") && <label className="search-box"><Search aria-hidden="true" /><input aria-label={view === "recipes" ? "Rezepte suchen" : "Einkaufsliste durchsuchen"} placeholder={view === "recipes" ? "Rezepte oder Zutaten suchen" : "Einkaufsliste durchsuchen"} value={query} onChange={(event) => setQueries((current) => ({ ...current, [view]: event.target.value }))} /></label>}
        <button type="button" className={`account-button ${!sync.warning && (sync.phase === "synced" || sync.phase === "saving") ? "is-connected" : "is-disconnected"}`} onClick={() => setView("settings")} title={`${commentAuthor ?? "Konto"}: ${!sync.warning && (sync.phase === "synced" || sync.phase === "saving") ? "Sync verbunden" : "Sync nicht verbunden"}`} aria-label={`${commentAuthor ?? "Konto"}, ${!sync.warning && (sync.phase === "synced" || sync.phase === "saving") ? "Sync verbunden" : "Sync nicht verbunden"}. Einstellungen öffnen.`}>{commentAuthor ? commentAuthor.slice(0, 1).toUpperCase() : <CircleUserRound aria-hidden="true" />}</button>
      </header>
      {sync.warning && <div className="sync-warning" role="alert"><CircleAlert aria-hidden="true" /><span><strong>{sync.requiresLogin ? "Anmeldung erforderlich" : "Synchronisierung unterbrochen"}</strong><br />{sync.warning}</span><button type="button" onClick={() => sync.requiresLogin ? window.location.reload() : setView("settings")}>{sync.requiresLogin ? "Anmelden" : "Prüfen"}</button></div>}
      {view === "settings" && <section className="settings-surface" aria-labelledby="settings-title">
        <div className="page-heading"><div><p className="eyebrow">Dein Nuzzle</p><h1 id="settings-title">Einstellungen</h1><p>Benachrichtigungen und gemeinsame Daten verwalten.</p></div></div>
        <button type="button" className="settings-back" onClick={() => setView("home")}><ArrowLeft /> Home</button>
        <NuzzleThemeSettings />
        <div className="settings-card"><div className="push-settings"><div><strong><Bell aria-hidden="true" />Aufgaben-Erinnerungen</strong><p>{push.status === "checking" ? "Benachrichtigungen werden geprüft …" : push.status === "unavailable" ? "Status vorübergehend nicht prüfbar. Nuzzle versucht es erneut." : push.enabled ? "Auf diesem Gerät aktiviert. Termine gelten in deutscher Zeit." : "Lass dich vor dem Termin und bei Fälligkeit erinnern. Auf jedem Gerät separat aktivieren."}</p>{push.status !== "checking" && !push.supported && <p>Dieser Browser unterstützt Push hier nicht. Auf iPhone und iPad Nuzzle zuerst zum Home-Bildschirm hinzufügen.</p>}{push.status === "unavailable" && <p>Bitte Internetverbindung und Anmeldung prüfen. Eine bestehende Geräteanmeldung wird dadurch nicht gelöscht.</p>}{push.status !== "checking" && push.supported && !push.configured && <p>Benachrichtigungsdienst noch nicht verfügbar. Bitte Anmeldung und Verbindung prüfen.</p>}{push.message && <p role="status">{push.message}</p>}</div><div className="push-actions">{push.enabled ? <><Button variant="outline" disabled={push.busy} onClick={() => void push.test()}>Test senden</Button><Button variant="outline" disabled={push.busy} onClick={() => void push.disable()}>Deaktivieren</Button></> : push.status === "disabled" ? <Button variant="outline" disabled={push.busy || !push.supported || !push.configured} onClick={() => void push.enable()}>Benachrichtigungen aktivieren</Button> : null}</div></div></div>
        <div className="settings-card notification-options"><h2>Benachrichtigungen auf diesem Gerät</h2><label htmlFor="reminder-default-time">Uhrzeit für Aufgaben ohne Uhrzeit</label><input id="reminder-default-time" type="time" value={push.reminderTime} disabled={!push.enabled || push.busy} onChange={(event) => { if (event.target.value) void push.savePreferences(event.target.value, push.shoppingEnabled); }} /><label className="shopping-push-toggle"><input type="checkbox" checked={push.shoppingEnabled} disabled={!push.enabled || push.busy} onChange={(event) => void push.savePreferences(push.reminderTime, event.target.checked)} />Einkaufsbenachrichtigungen aktivieren</label><p>Für neue Artikel und Einkäufe der anderen Person. Nach fünf Minuten werden nur weiterhin gültige Änderungen gemeldet.</p>{push.status === "disabled" && <p>Aktiviere zuerst Benachrichtigungen auf diesem Gerät.</p>}<Button variant="outline" onClick={() => void push.downloadDiagnostics()}>Benachrichtigungsprotokoll herunterladen</Button><p>Enthält nur technische Ereignisse dieses Geräts, keine Aufgaben- oder Artikelnamen und keine Push-Zugangsdaten.</p></div>
        <div className="settings-card sync-settings">
        <h2>Synchronisierung und Sicherung</h2><p>Teile Einkaufslisten, Aufgaben und Rezepte mit deinem Haushalt. Deine Ansichtseinstellungen bleiben auf diesem Gerät.</p>
        {(sync.phase === "local" || sync.phase === "error") && <><p>{sync.message || "Derzeit sind deine Daten nur auf diesem Gerät gespeichert."}</p>{sync.requiresLogin ? <Button onClick={() => window.location.reload()}>Erneut anmelden</Button> : <Button onClick={() => void sync.connect()}>Gemeinsamen Speicher verbinden</Button>}</>}
        {sync.phase === "checking" && <p role="status">Verbindung wird geprüft …</p>}
        {sync.phase === "choose" && <>{sync.remote?.data ? <><p>Es sind bereits gemeinsame Daten vorhanden. Beim Laden wird zunächst eine lokale Sicherung erstellt.</p><Button onClick={() => void sync.useCloud()}>Gemeinsame Daten laden</Button></> : <><p>Der gemeinsame Speicher ist leer. Du kannst die Daten dieses Geräts einmalig übernehmen. Daten aus der lokalen Vorschau lassen sich zuerst als Sicherungsdatei laden.</p><label className="sync-file">Sicherung von diesem Gerät laden<input type="file" accept="application/json,.json" onChange={(event) => { void loadLocalBackup(event.target.files?.[0]); event.target.value = ""; }} /></label><Button onClick={sync.importLocal}>Daten dieses Geräts übernehmen</Button></>}</>}
        {(sync.phase === "synced" || sync.phase === "saving") && <p role="status">{sync.phase === "saving" ? "Änderungen werden gespeichert …" : "Gemeinsamer Speicher ist verbunden."}</p>}
        {sync.phase === "conflict" && <><p role="alert">{sync.message}</p><p>Deine noch nicht synchronisierten Änderungen würden beim Laden der gemeinsamen Daten auf diesem Gerät ersetzt. Sichere sie zuerst als Datei. Nuzzle legt zusätzlich eine lokale Sicherung an.</p><Button variant="outline" onClick={() => void sync.connect()}>Erneut prüfen</Button><Button variant="outline" onClick={downloadLocalBackup}>Daten dieses Geräts sichern</Button><Button onClick={() => { if (window.confirm("Gemeinsame Daten laden? Nicht synchronisierte Änderungen auf diesem Gerät werden ersetzt. Eine lokale Sicherung wird angelegt.")) void sync.useCloud(); }}>Gemeinsame Daten laden</Button></>}
        <p>Das Sync-Protokoll bleibt auf diesem Gerät und enthält technische Ereignisse, keine Haushaltsdaten. Es umfasst höchstens die letzten 200 Einträge.</p>
        <Button variant="outline" onClick={downloadSyncLog}>Sync-Protokoll herunterladen</Button>
        <Button variant="outline" onClick={downloadLocalBackup}>Lokale Sicherung herunterladen</Button>
        </div><p className="app-version">Nuzzle · Version {appVersion}</p>
      </section>}

      {view === "home" && <section className="home-surface" aria-labelledby="home-title">
        <div className="home-heading"><p className="eyebrow">Zuhause auf einen Blick</p><h1 id="home-title">Was steht heute an?</h1><p>Alles Wichtige für euren Alltag – ohne Umwege.</p></div>
        <div className="home-grid">
          <button className="home-tile home-tile--shopping" type="button" onClick={() => setView("shopping")}><span className="home-tile-icon"><ShoppingBasket /></span><span className="home-tile-copy"><small>{items.length} offen</small><strong>Einkaufszettel</strong><em>Nichts vergessen und schneller durch den Laden.</em><HomeActivity state={notices.state} kind="new-item" prefix="item" label="Neu" /><HomeActivity state={notices.state} kind="purchased" prefix="purchase" label="Eingekauft" /></span><ArrowRight /></button>
          <button className="home-tile home-tile--recipes" type="button" onClick={() => setView("recipes")}><span className="home-tile-icon"><BookOpen /></span><span className="home-tile-copy"><small>{recipes.length} Rezepte</small><strong>Kochbuch</strong><em>Lieblingsgerichte finden, planen und zubereiten.</em>{describeNotices(notices.state, "recipes").map((label) => <span className="home-new" key={label}>{label}</span>)}</span><ArrowRight /></button>
          <button className="home-tile home-tile--tasks" type="button" onClick={() => setView("tasks")}><span className="home-tile-icon"><ClipboardCheck /></span><span className="home-tile-copy"><small>{tasks.filter((task) => !task.done).length} Aufgaben</small><strong>Aufgaben</strong><em>Kleine Dinge gemeinsam im Blick behalten.</em><HomeActivity state={notices.state} kind="new-task" prefix="task" label="Neu" /><HomeActivity state={notices.state} kind="completed-task" prefix="done" label="Erledigt" />{describeNotices(notices.state, "tasks").filter((label) => /Kommentar|Foto/.test(label)).map((label) => <span className="home-new" key={label}>{label}</span>)}</span><ArrowRight /></button>
          <button className="home-tile home-tile--settings" type="button" onClick={() => setView("settings")}><span className="home-tile-icon"><Settings /></span><span className="home-tile-copy"><small>Dein Nuzzle</small><strong>Einstellungen</strong><em>Erinnerungen, Synchronisierung und Sicherung.</em></span><ArrowRight /></button>
        </div>
        <section className="home-today"><div><p className="eyebrow">Im Blick</p><h2>Als Nächstes</h2></div><div className="today-summary">{[...tasks].filter((task) => !task.done && task.dueDate).sort((a, b) => (a.dueDate + (a.dueTime ?? "")).localeCompare(b.dueDate + (b.dueTime ?? ""))).slice(0, 3).map((task) => <div className={`today-task reminder-${taskReminderState(task, reminderNow)}`} key={task.id}><button type="button" className="task-check" aria-label={`${task.title} erledigen`} onClick={() => completeTask(task)}><span className="task-check-mark" aria-hidden="true" /></button><button type="button" className="today-task-main" onClick={() => { setView("tasks"); openTaskEditor(task); }}><span><strong>{task.title}</strong>{formatTaskDate(task.dueDate)}{task.dueTime && ` · ${task.dueTime} Uhr`}<TaskReminderLabel task={task} now={reminderNow} /><TaskActivity task={task} readIds={readTaskComments[task.id]} author={commentAuthor} /></span></button></div>)}{!tasks.some((task) => !task.done && task.dueDate) && <p className="home-no-due">Keine Aufgaben mit Termin.</p>}</div></section>
      </section>}

      {view === "shopping" && <div className="content-grid">
        <section className="shopping-column" aria-labelledby="shopping-title">
          <div className="page-heading"><div><p className="eyebrow">Gemeinsame Liste</p><h1 id="shopping-title">Einkaufsliste</h1><p>{items.length} offene Posten</p></div><Button variant="outline" className="sort-button" title={`Sortierung: ${sortMode === "alphabetical" ? "alphabetisch" : sortMode === "chronological" ? "chronologisch" : "eigene Reihenfolge"}`} aria-label={`Sortierung: ${sortMode === "alphabetical" ? "alphabetisch" : sortMode === "chronological" ? "chronologisch" : "eigene Reihenfolge"}. Tippen zum Ändern.`} onClick={() => setSortMode((current) => current === "custom" ? "chronological" : current === "chronological" ? "alphabetical" : "custom")}>{sortMode === "alphabetical" ? <span>A–Z</span> : sortMode === "chronological" ? <Clock3 /> : <ListFilter />}</Button></div>
          <div className="open-list" aria-label="Offene Einkaufsposten">
            {sortedItems.filter((item) => `${item.name} ${itemDetail(item)} ${item.note ?? ""}`.toLowerCase().includes(query.toLowerCase())).length === 0 ? <div className="empty-list"><ShoppingBasket /><strong>{query ? "Nichts gefunden" : "Alles besorgt"}</strong><span>{query ? "Versuche einen anderen Suchbegriff." : "Die Liste ist leer."}</span></div> : sortedItems.filter((item) => `${item.name} ${itemDetail(item)} ${item.note ?? ""}`.toLowerCase().includes(query.toLowerCase())).map((item) => <ShoppingRow item={item} isNew={notices.state.newItems.includes(item.id)} dragging={draggingItemId === item.id} dropPosition={shoppingDropTarget?.itemId === item.id ? shoppingDropTarget.position : undefined} onComplete={() => { if (!suppressShoppingClick.current) { notices.acknowledgeItem(item.id); completeItem(item); } }} onEdit={() => { notices.acknowledgeItem(item.id); void openFreshItemEditor(item); }} onMove={(direction) => { const index = sortedItems.findIndex((entry) => entry.id === item.id); const target = sortedItems[index + direction]; if (target) { reorderShoppingItem(item.id, { itemId: target.id, position: direction < 0 ? "before" : "after" }); showNotice(`${item.name} verschoben`); } }} onPointerDown={(event) => { if (event.button !== 0) return; const gesture = { itemId: item.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, touch: event.pointerType === "touch", scrolling: false, held: false, moved: false, lastY: event.clientY, timer: undefined as number | undefined }; shoppingPointer.current = gesture; if (gesture.touch || event.pointerType === "mouse") { const element = event.currentTarget; gesture.timer = window.setTimeout(() => { if (shoppingPointer.current !== gesture || gesture.scrolling || gesture.dragging) return; gesture.held = true; gesture.dragging = true; suppressShoppingClick.current = true; if (element.isConnected) element.setPointerCapture(gesture.pointerId); setDraggingItemId(item.id); }, 350); } }} onPointerMove={(event) => { const gesture = shoppingPointer.current; if (!gesture || gesture.pointerId !== event.pointerId) return; if (gesture.touch && !gesture.dragging) { if (gesture.scrolling || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { if (gesture.timer) window.clearTimeout(gesture.timer); if (!gesture.scrolling) event.currentTarget.setPointerCapture(event.pointerId); gesture.scrolling = true; suppressShoppingClick.current = true; window.scrollBy(0, gesture.lastY - event.clientY); gesture.lastY = event.clientY; } return; } shoppingDragPoint.current = { x: event.clientX, y: event.clientY }; if (gesture.held && !gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { gesture.moved = true; startShoppingAutoScroll(); } if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { gesture.dragging = true; suppressShoppingClick.current = true; event.currentTarget.setPointerCapture(event.pointerId); setDraggingItemId(item.id); startShoppingAutoScroll(); } if (gesture.dragging) { event.preventDefault(); setShoppingDropTarget(shoppingTargetFromPoint(event.clientX, event.clientY)); } }} onPointerUp={(event) => { const gesture = shoppingPointer.current; if (gesture?.timer) window.clearTimeout(gesture.timer); if (gesture?.dragging) { event.preventDefault(); const edit = gesture.held && !gesture.moved; finishShoppingDrag(edit ? null : item.id, edit ? null : shoppingTargetFromPoint(event.clientX, event.clientY)); if (edit) { notices.acknowledgeItem(item.id); void openFreshItemEditor(item); } } if (gesture?.dragging || gesture?.scrolling) window.setTimeout(() => { suppressShoppingClick.current = false; }, gesture.held ? 700 : 0); shoppingPointer.current = null; }} onPointerCancel={() => { if (shoppingPointer.current?.timer) window.clearTimeout(shoppingPointer.current.timer); finishShoppingDrag(null, null); window.setTimeout(() => { suppressShoppingClick.current = false; }, 0); }} key={item.id} />)}
          </div>
          <div className="shelves" aria-label="Produktauswahl">
            <Shelf title="Zuletzt verwendet" count={recentSuggestions.length} open={openShelves.recent} onOpenChange={(open) => setOpenShelves((current) => ({ ...current, recent: open }))}>{recentGroups.map((group) => <section className="recent-date-group" aria-label={group.label} key={group.label}><h3>{group.label}</h3><div className="suggestion-grid">{group.items.map((item) => <SuggestionRow item={item} onAdd={moveRecentToList} onEdit={() => openSuggestionEditor({ kind: recipeRecent.includes(item) ? "recipeRecent" : "recent", id: item.id, item })} key={item.id} />)}</div></section>)}</Shelf>
            <Shelf title="Häufig verwendet" count={frequent.length} open={openShelves.frequent} onOpenChange={(open) => setOpenShelves((current) => ({ ...current, frequent: open }))}><div className="suggestion-grid">{frequent.length === 0 && <p className="rediscover-empty">Hier erscheinen Artikel, die mindestens zweimal abgehakt wurden.</p>}{frequent.map((group) => { const item = recent.find((entry) => entry.frequentKey === group.key) ?? group.item; return <SuggestionRow item={item} onAdd={addSuggestion} onEdit={() => openSuggestionEditor({ kind: "frequent", id: group.key, item })} key={group.key} />; })}</div></Shelf>
            <Shelf title="Immer da" count={pantry.length} open={openShelves.pantry} onOpenChange={(open) => setOpenShelves((current) => ({ ...current, pantry: open }))}><div className="pantry-manage"><Button type="button" variant="outline" onClick={() => setPantryDialog(true)}><Pencil />Liste bearbeiten</Button></div><div className="suggestion-grid">{pantry.map((item) => <SuggestionRow item={item} onAdd={addSuggestion} onEdit={() => openSuggestionEditor({ kind: "pantry", id: item.id, item })} key={item.id} />)}</div></Shelf>
          </div>
        </section>
        <aside className="today-card rediscover-card"><div className="today-icon"><ShoppingBasket /></div><p className="eyebrow">Wiederentdecken</p><h2>Lange nicht gekauft</h2><p>Schon einmal abgehakt, seit einer Weile nicht mehr auf der Liste.</p><div className="rediscover-grid">{rediscover.map((record) => <SuggestionRow item={record.item} onAdd={addSuggestion} onEdit={() => openSuggestionEditor({ kind: "history", id: record.id, item: record.item })} key={record.id} />)}{rediscover.length === 0 && <span className="rediscover-empty">Gerade keine passenden Vorschläge.</span>}</div>{rediscover.length > 1 && <button className="rediscover-refresh" type="button" onClick={() => setSuggestionSeed(Math.floor(Math.random() * 2147483647))}>Andere zeigen</button>}</aside>
      </div>}
      {view === "recipes" && <section className="recipes-surface" aria-labelledby="recipes-title">
        <div className="recipes-heading"><div><p className="eyebrow">Euer Kochbuch</p><h1 id="recipes-title">Rezepte</h1><p>{recipes.length} Rezepte · {recipes.reduce((sum, recipe) => sum + madeCount(recipe), 0)}-mal zubereitet</p></div></div>
        <div className="recipe-library-controls"><label className="recipe-sort">Sortierung<select value={recipeSort} onChange={(event) => setRecipeSort(event.target.value as RecipeSort)}><option value="chronological">Neueste zuerst</option><option value="alphabetical">Alphabetisch A–Z</option></select></label></div>
        <div ref={categoryStripRef} className="category-strip" aria-label="Rezeptkategorien" onClickCapture={(event) => { if (suppressCategoryClick.current) { event.preventDefault(); event.stopPropagation(); } }} onPointerDown={(event) => { if (event.button !== 0) return; categoryPointer.current = { pointerId: event.pointerId, x: event.clientX, scrollLeft: event.currentTarget.scrollLeft, dragging: false }; }} onPointerMove={(event) => { const gesture = categoryPointer.current; if (!gesture || gesture.pointerId !== event.pointerId) return; const delta = event.clientX - gesture.x; if (Math.abs(delta) > 5 && !gesture.dragging) { gesture.dragging = true; suppressCategoryClick.current = true; event.currentTarget.setPointerCapture(event.pointerId); } if (gesture.dragging) event.currentTarget.scrollLeft = gesture.scrollLeft - delta; }} onPointerUp={() => { categoryPointer.current = null; window.setTimeout(() => { suppressCategoryClick.current = false; }, 0); }} onPointerCancel={() => { categoryPointer.current = null; suppressCategoryClick.current = false; }}>{categories.map((entry) => <button type="button" className={category === entry ? "active" : ""} onClick={() => setCategory(entry)} key={entry}>{entry}</button>)}<button className="category-add" type="button" onClick={() => setCategoryDialog(true)}><Plus />Kategorie</button></div>
        {recipeGroups.filter((group) => group.recipes.length > 0).map((group) => <section className="recipe-group" key={group.label || "all"} aria-label={group.label || "Rezepte"}>{group.label && <div className="section-title"><h2>{group.label}</h2>{group.label === "Neu" && <span>Von deinem anderen Haushaltsmitglied</span>}</div>}<div className="recipe-grid">{group.recipes.map((recipe) => {
          const Icon = recipeIcons[recipe.icon]; const made = madeCount(recipe);
          return <article className="recipe-card" key={recipe.id}>
            <div className="recipe-card-main" role="button" tabIndex={0} onClick={() => { setSelectedVersionIds([]); setViewedRecipeIds((ids) => ids.includes(recipe.id) ? ids : [...ids, recipe.id]); setSelectedRecipeId(recipe.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedVersionIds([]); setViewedRecipeIds((ids) => ids.includes(recipe.id) ? ids : [...ids, recipe.id]); setSelectedRecipeId(recipe.id); } }}>
              <div className={`recipe-visual ${recipe.image ? "has-image" : `recipe-visual--${recipe.icon}`}`}>{recipe.image ? <img src={recipe.image} alt={recipe.title} /> : <Icon />}
                {(made > 0 || visitRecipeIds.includes(recipe.id)) && <span className="made-badge">{made ? `${made}× zubereitet` : "Neu"}</span>}
              </div>
              <div className="recipe-copy"><div className="recipe-tags">{recipe.favorite && <span><Heart />Liebling</span>}</div><h2>{recipe.title}</h2><p>{recipe.description}</p><div className="recipe-meta">{recipe.minutes != null && <span><Clock3 />{recipe.minutes} Min.</span>}{recipe.servings != null && <span><UsersRound />{recipe.servings}</span>}<StarRating value={recipe.rating} compact /></div></div>
            </div>
            <div className="recipe-card-source"><RecipeSourceLine recipe={recipe} /></div>
            <button className={`favorite-button ${recipe.favorite ? "active" : ""}`} type="button" aria-label={recipe.favorite ? `${recipe.title} aus Lieblingsrezepten entfernen` : `${recipe.title} zu Lieblingsrezepten hinzufügen`} onClick={() => patchRecipe(recipe.id, { favorite: !recipe.favorite })}><Heart /></button>
          </article>;
        })}</div></section>)}
        {visibleRecipes.length === 0 && <div className="recipe-empty"><Search /><strong>Kein passendes Rezept</strong><span>Ändere Suche oder Kategorie.</span></div>}
      </section>}

      {view === "tasks" && <section className="tasks-surface" aria-labelledby="tasks-title">
        <div className="tasks-heading"><div><p className="eyebrow">Gemeinsam im Blick</p><h1 id="tasks-title">Aufgaben</h1><p>{tasks.filter((task) => !task.done).length} Aufgaben · {taskLanes.length} Bereiche</p></div><div className="task-view-switch" aria-label="Aufgabenansicht"><button type="button" className={taskView === "board" ? "active" : ""} onClick={() => setTaskView("board")}><LayoutPanelTop />Board</button><button type="button" className={taskView === "calendar" ? "active" : ""} onClick={() => setTaskView("calendar")}><CalendarDays />Termine</button></div></div>
        {push.status === "disabled" && <div className="push-settings"><div><strong><Bell aria-hidden="true" />Aufgaben-Erinnerungen</strong><p>Erinnerungen lassen sich für dieses Gerät in den Einstellungen aktivieren.</p></div><Button variant="outline" onClick={() => setView("settings")}>Einstellungen öffnen</Button></div>}
        <Button className="task-add-button" onClick={() => openLaneEditor()}><Plus />Bereich hinzufügen</Button>
        {taskView === "board" ? <div ref={taskBoardRef} className={`task-board ${draggingTaskId !== null ? "is-dragging" : ""}`}>{taskLanes.map((lane, laneIndex) => <section className={`task-column ${dropTarget?.laneId === lane.id && dropTarget.taskId === null ? "is-drag-over" : ""}`} style={{ "--lane-color": lane.color } as CSSProperties} data-lane-id={lane.id} key={lane.id}><div className="task-column-title"><button className="lane-name-button" type="button" onClick={() => openLaneEditor(lane)} aria-label={`${lane.title} bearbeiten`}><h2>{lane.title}</h2><Pencil /></button><div className="lane-order-buttons" aria-label={`${lane.title} verschieben`}><button type="button" onClick={() => moveLane(lane.id, -1)} disabled={laneIndex === 0} aria-label={`${lane.title} nach links oder oben verschieben`}><ArrowLeft /></button><button type="button" onClick={() => moveLane(lane.id, 1)} disabled={laneIndex === taskLanes.length - 1} aria-label={`${lane.title} nach rechts oder unten verschieben`}><ArrowRight /></button></div><button className="lane-task-add" type="button" onClick={() => openTaskEditor(undefined, lane.id)}><Plus />Neue Aufgabe</button></div><div className="task-card-list">{tasks.filter((task) => !task.done && task.status === lane.id).map((task) => <article data-task-id={task.id} className={`task-card reminder-${taskReminderState(task, reminderNow)} ${draggingTaskId === task.id ? "is-dragging" : ""} ${dropTarget?.taskId === task.id ? `drop-${dropTarget.position}` : ""}`} key={task.id} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { if (event.button !== 0) return; if (taskInertiaFrame.current !== null) window.cancelAnimationFrame(taskInertiaFrame.current); taskInertiaFrame.current = null; const gesture = { taskId: task.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, touch: event.pointerType === "touch", scrolling: false, lastY: event.clientY, lastTime: performance.now(), velocity: 0, timer: undefined as number | undefined }; taskPointer.current = gesture; if (gesture.touch) { const element = event.currentTarget; gesture.timer = window.setTimeout(() => { if (taskPointer.current !== gesture || gesture.scrolling) return; gesture.dragging = true; suppressTaskClick.current = true; if (element.isConnected) element.setPointerCapture(gesture.pointerId); dragPoint.current = { x: gesture.x, y: gesture.y }; setDraggingTaskId(task.id); startTaskAutoScroll(); }, 350); } }} onPointerMove={(event) => { const gesture = taskPointer.current; if (!gesture || gesture.pointerId !== event.pointerId) return; if (gesture.touch && !gesture.dragging) { if (gesture.scrolling || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { if (gesture.timer) window.clearTimeout(gesture.timer); if (!gesture.scrolling) event.currentTarget.setPointerCapture(event.pointerId); gesture.scrolling = true; suppressTaskClick.current = true; const now = performance.now(); const delta = gesture.lastY - event.clientY; const speed = delta / Math.max(1, now - gesture.lastTime); gesture.velocity = Math.max(-2, Math.min(2, gesture.velocity * .35 + speed * .65)); gesture.lastTime = now; gesture.lastY = event.clientY; window.scrollBy(0, delta); event.preventDefault(); } return; } dragPoint.current = { x: event.clientX, y: event.clientY }; if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { gesture.dragging = true; suppressTaskClick.current = true; event.currentTarget.setPointerCapture(event.pointerId); setDraggingTaskId(task.id); startTaskAutoScroll(); } if (gesture.dragging) { event.preventDefault(); setDropTarget(targetFromPoint(event.clientX, event.clientY)); } }} onPointerUp={(event) => { const gesture = taskPointer.current; if (gesture?.timer) window.clearTimeout(gesture.timer); if (gesture?.dragging) { event.preventDefault(); finishTaskDrag(task.id, targetFromPoint(event.clientX, event.clientY)); } else if (gesture?.scrolling) { event.preventDefault(); if (performance.now() - gesture.lastTime < 100) continueTaskScroll(gesture.velocity); } if (gesture?.dragging || gesture?.scrolling) window.setTimeout(() => { suppressTaskClick.current = false; }, gesture.touch ? 400 : 0); taskPointer.current = null; }} onPointerCancel={() => { if (taskPointer.current?.timer) window.clearTimeout(taskPointer.current.timer); finishTaskDrag(null, null); window.setTimeout(() => { suppressTaskClick.current = false; }, 0); }}><span className="task-drag-handle" title="Zum Verschieben halten und ziehen" aria-hidden="true"><GripVertical /></span><button type="button" className="task-check task-card-check" aria-label={`${task.title} erledigen`} onPointerDown={(event) => event.stopPropagation()} onClick={() => completeTask(task)}><span className="task-check-mark" aria-hidden="true" /></button><button className="task-card-main" type="button" aria-description="Mit Alt und Pfeiltasten oder über den Griff verschieben" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" onKeyDown={(event) => { if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const laneTasks = tasks.filter((entry) => !entry.done && entry.status === lane.id); const index = laneTasks.findIndex((entry) => entry.id === task.id); const direction = event.key === "ArrowUp" ? -1 : 1; const target = laneTasks[index + direction]; if (target) { reorderTask(task.id, { laneId: lane.id, taskId: target.id, position: direction < 0 ? "before" : "after" }); showNotice(`${task.title} verschoben`); } }} onClick={() => { if (!suppressTaskClick.current) openTaskEditor(task); }}><strong>{task.title}</strong>{(task.description ?? task.note) && <p>{task.description ?? task.note}</p>}<span className="task-card-meta"><em>{taskPerson(task.assignee)}</em><time dateTime={task.dueDate}>{formatTaskDate(task.dueDate)}{task.dueTime && ` · ${task.dueTime}`}</time><TaskReminderLabel task={task} now={reminderNow} />{task.priority && <em className={`task-priority task-priority--${task.priority}`}>{task.priority}</em>}</span><TaskActivity task={task} readIds={readTaskComments[task.id]} author={commentAuthor} /></button></article>)}{!tasks.some((task) => !task.done && task.status === lane.id) && <div className="task-column-empty">Keine Aufgaben</div>}</div></section>)}</div> : <div className="task-calendar">{[...tasks].filter((task) => !task.done).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")).map((task) => <button type="button" className={`calendar-task reminder-${taskReminderState(task, reminderNow)}`} key={task.id} onClick={() => openTaskEditor(task)}><span className="calendar-date"><strong>{task.dueDate ? formatTaskDate(task.dueDate).split(" ")[0] : "–"}</strong><small>{task.dueDate ? formatTaskDate(task.dueDate).split(" ").slice(1).join(" ") : "offen"}</small></span><span className="calendar-copy"><strong>{task.title}</strong><small>{taskPerson(task.assignee)} · {taskLanes.find((lane) => lane.id === task.status)?.title}{task.dueTime && ` · ${task.dueTime} Uhr`}</small><TaskReminderLabel task={task} now={reminderNow} /></span><Pencil /></button>)}</div>}
        <div className="task-archive"><Shelf title="Erledigte Aufgaben" count={tasks.filter((task) => task.done).length} open={taskArchiveOpen} onOpenChange={setTaskArchiveOpen}>{tasks.filter((task) => task.done).length === 0 ? <p className="task-archive-empty">Noch keine erledigten Aufgaben.</p> : tasks.filter((task) => task.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).map((task) => <div className="task-archive-row" key={task.id}><span><strong>{task.title}</strong><small>{taskLanes.find((lane) => lane.id === task.status)?.title ?? "Unbekannt"}{task.completedAt && ` · ${new Date(task.completedAt).toLocaleDateString("de-DE")}`}</small></span><button type="button" onClick={() => restoreTask(task)} aria-label={`${task.title} zurückschieben`}><Undo2 />Zurück</button></div>)}</Shelf></div>
      </section>}

      {(view === "shopping" || view === "recipes") && <Button className="fab" onClick={() => view === "recipes" ? openImportDialog() : openItemEditor()}><Plus />{view === "recipes" ? "Rezept hinzufügen" : "Posten hinzufügen"}</Button>}
      {(lastDone || lastDeleted || lastTaskDone || notice) && <div className="undo-toast" role="status"><span>{lastDone ? <><strong>{lastDone.name}</strong> erledigt</> : lastDeleted ? <><strong>{lastDeleted.name}</strong> gelöscht</> : lastTaskDone ? <><strong>{lastTaskDone.title}</strong> erledigt</> : notice}</span>{lastDone && <button onClick={undoComplete} type="button"><Undo2 />Rückgängig</button>}{lastTaskDone && <button onClick={() => restoreTask(lastTaskDone)} type="button"><Undo2 />Rückgängig</button>}{lastDeleted && <button onClick={undoDelete} type="button"><Undo2 />Rückgängig</button>}<button className="toast-close" onClick={() => { setLastDone(null); setLastDeleted(null); setLastTaskDone(null); setNotice(null); }} type="button" aria-label="Hinweis schließen"><X /></button></div>}
    </section>

    <Sheet open={itemDialog} onOpenChange={setItemDialog}><SheetContent className={`editor-sheet item-editor-sheet ${editingRecipeIngredientId ? "recipe-item-editor-sheet" : ""}`} side="right" showCloseButton={false}><SheetHeader className="editor-sheet-header"><button className="editor-back" type="button" onClick={() => setItemDialog(false)}><ArrowLeft />{editingRecipeIngredientId ? "Zutaten einkaufen" : "Einkaufszettel"}</button><SheetTitle>{editingRecipeIngredientId ? "Zutat anpassen" : editingItemId === null ? "Neuer Einkaufsposten" : "Posten bearbeiten"}</SheetTitle><SheetDescription className="sr-only">Menge, Einheit und weitere Angaben des Einkaufspostens bearbeiten.</SheetDescription></SheetHeader><div className="editor-sheet-scroll"><div className="touch-form">
      <div className="field-block"><Label htmlFor="item-name">Produkt</Label><div className="product-name-entry"><button className="product-icon-trigger" type="button" onClick={() => { setIconCategory("Alle"); setIconDialog(true); }} aria-label="Produktsymbol auswählen"><ProductGlyph name={name} iconOverride={itemIconOverride} /><Pencil aria-hidden="true" /></button><Input id="item-name" value={name} onChange={(event) => { setName(event.target.value); setItemPantryOverride(null); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.repeat && !event.nativeEvent.isComposing && editingItemId === null && !editingSuggestion && !editingRecipeIngredientId) { event.preventDefault(); saveItem(); } }} placeholder="z. B. Tomaten" autoFocus={!name.trim()} />{editingItemId === null && !editingSuggestion && !editingRecipeIngredientId && <button className="product-name-add" type="button" aria-label="Artikel hinzufügen" title="Artikel hinzufügen" onClick={saveItem} disabled={!name.trim() || Boolean(itemAmount.trim() && parsePositiveAmount(itemAmount) === null)}><Plus aria-hidden="true" /></button>}</div></div>
      <div className="field-block"><Label htmlFor="item-amount">Menge</Label><div className="quantity-picker">{[1, 2, 6, 10, 50, 100, 250, 500].map((value) => <button className={parsePositiveAmount(itemAmount) === value ? "quantity-button active" : "quantity-button"} type="button" onClick={() => setItemAmount(String(value))} key={value}>{value}</button>)}</div><Input id="item-amount" type="text" inputMode="decimal" value={itemAmount} onChange={(event) => setItemAmount(event.target.value)} placeholder="Andere Menge" aria-invalid={Boolean(itemAmount.trim() && parsePositiveAmount(itemAmount) === null)} /></div>
      <div className="field-block"><Label>Einheit</Label><div className="unit-picker">{shoppingUnits.map((unit) => <button type="button" className={itemUnit === unit ? "active" : ""} onClick={() => setItemUnit(unit)} key={unit}>{unit}</button>)}</div></div>
      <div className="field-block"><Label>Typ</Label><div className="preset-row food-types">{["Bio", "Regional", "Lose", "Frisch", "TK", "Reif", "Vollkorn", "Fettarm", "Laktosefrei", "Glutenfrei", "Vegan", "Vegetarisch", "Festkochend", "Mild", "Scharf", "Sensitiv"].map((type) => <button className={itemType === type ? "touch-chip active" : "touch-chip"} type="button" onClick={() => setItemType(itemType === type ? "" : type)} key={type}>{type}</button>)}</div><Input value={itemType} onChange={(event) => setItemType(event.target.value)} placeholder="oder eigenen Typ eingeben" /></div>
      {!editingRecipeIngredientId && <div className="ingredient-flags"><label><Checkbox checked={itemPantryOverride ?? (editingSuggestion?.kind === "pantry" || pantry.some((entry) => productKey(entry.name) === productKey(name)))} onCheckedChange={(checked) => setItemPantryOverride(Boolean(checked))} disabled={!name.trim()} />Immer da</label></div>}
      <div className="field-block"><Label htmlFor="item-note">Notiz</Label><textarea id="item-note" value={itemNote} onChange={(event) => setItemNote(event.target.value)} placeholder="z. B. am liebsten lose" rows={2} /></div>
    </div></div><SheetFooter className="editor-sheet-footer item-dialog-footer">{editingItemId !== null && !editingRecipeIngredientId && !editingSuggestion && <Button className="delete-button" variant="outline" onClick={deleteItem}><Trash2 />Löschen</Button>}<Button onClick={saveItem} disabled={!name.trim() || Boolean(itemAmount.trim() && parsePositiveAmount(itemAmount) === null)}>{editingRecipeIngredientId ? "Übernehmen" : editingItemId === null ? "Hinzufügen" : "Speichern"}</Button></SheetFooter></SheetContent></Sheet>

    <Dialog open={iconDialog} onOpenChange={(open) => { setIconDialog(open); if (!open) setIconTargetName(null); }}><DialogContent className={`product-icon-dialog ${editingRecipeIngredientId ? "recipe-item-icon-dialog" : ""}`}><DialogHeader><DialogTitle>Produktsymbol auswählen</DialogTitle><DialogDescription>Das Symbol gilt in Nuzzle für Produkte mit diesem Namen.</DialogDescription></DialogHeader><div className="product-icon-categories" role="group" aria-label="Symbolkategorien">{(["Alle", ...productIconGroups] as const).map((group) => <button type="button" className={iconCategory === group ? "active" : ""} aria-pressed={iconCategory === group} onClick={() => setIconCategory(group)} key={group}>{group}</button>)}</div><div className="product-icon-choices"><button type="button" className={`product-icon-option product-icon-option--auto ${itemIconOverride === null ? "active" : ""}`} aria-pressed={itemIconOverride === null} onClick={() => selectProductIcon(null)}><ProductGlyph name={name} /><span>Automatisch</span></button>{productIconGroups.filter((group) => iconCategory === "Alle" || iconCategory === group).map((group) => <section className="product-icon-section" key={group}><h3>{group}</h3><div className="product-icon-grid">{productIconCatalog.filter((entry) => entry.group === group).map(({ icon, label }) => <button type="button" className={`product-icon-option ${itemIconOverride === icon ? "active" : ""}`} aria-pressed={itemIconOverride === icon} onClick={() => selectProductIcon(icon)} key={icon}><ProductGlyph name={name} iconOverride={icon} /><span>{label}</span></button>)}</div></section>)}</div></DialogContent></Dialog>

    <Sheet open={taskDialog} onOpenChange={(open) => { if (open) setTaskDialog(true); else saveTask(); }}><SheetContent className="editor-sheet task-editor-sheet" side="right" showCloseButton={false}><SheetHeader className="editor-sheet-header"><button className="editor-back" type="button" onClick={saveTask}><ArrowLeft />Aufgaben</button><SheetTitle>{editingTaskId === null ? "Neue Aufgabe" : "Aufgabe bearbeiten"}</SheetTitle><SheetDescription className="sr-only">Aufgabe zuweisen, terminieren und einem Bereich zuordnen.</SheetDescription></SheetHeader><div className="editor-sheet-scroll"><div className="touch-form">
      <div className="field-block"><Label htmlFor="task-title">Aufgabe</Label><Input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="z. B. Vorratsschrank aufräumen" autoFocus={!taskTitle.trim()} /></div>
      <div className="field-block"><Label>Bereich</Label><div className="task-choice-grid">{taskLanes.map((lane) => <button type="button" className={taskStatus === lane.id ? "active" : ""} onClick={() => setTaskStatus(lane.id)} key={lane.id}>{lane.title}</button>)}</div></div>
      <div className="field-block"><Label>Zugewiesen an</Label><div className="task-choice-grid">{(["Markus", "Bettina", "Gemeinsam"] as const).map((person) => <button type="button" className={taskAssignee === person ? "active" : ""} onClick={() => setTaskAssignee(person)} key={person}><UsersRound />{person}</button>)}</div></div>
      <div className="field-block"><Label>Priorität <span className="task-optional">(optional)</span></Label><div className="task-choice-grid">{(["Niedrig", "Mittel", "Hoch"] as const).map((priority) => <button type="button" className={taskPriority === priority ? `active priority-choice--${priority}` : ""} aria-pressed={taskPriority === priority} onClick={() => setTaskPriority(taskPriority === priority ? undefined : priority)} key={priority}>{priority}</button>)}</div></div>
      <div className="task-date-fields"><div className="field-block"><Label htmlFor="task-date">Datum</Label><Input id="task-date" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></div><div className="field-block"><Label htmlFor="task-time">Uhrzeit <span className="task-optional">(optional)</span></Label><Input id="task-time" type="time" value={taskDueTime} disabled={!taskDueDate} onChange={(event) => setTaskDueTime(event.target.value)} /></div></div>
      <div className="field-block"><Label htmlFor="task-reminder">Erinnerung</Label><select id="task-reminder" value={taskReminderMinutes} disabled={!taskDueDate} onChange={(event) => setTaskReminderMinutes(Number(event.target.value))}>{reminderOptions.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}</select><small>Orange nur am Fälligkeitstag, rot nach dem Termin. Der Push-Vorlauf gilt unabhängig davon. Ohne Uhrzeit erfolgt die Benachrichtigung zur in den Einstellungen gewählten Zeit; die Aufgabe bleibt bis Tagesende fällig. Deutsche Zeit (Europe/Berlin).</small></div>
      <div className="field-block"><Label htmlFor="task-note">Beschreibung</Label><textarea id="task-note" value={taskNote} onChange={(event) => setTaskNote(event.target.value)} placeholder="Optional: eine Beschreibung" rows={3} /></div>
      <div className="field-block"><Label>Bilder</Label><div className="task-images">{taskImages.map((image, index) => <div className="task-image" key={`${image.slice(-40)}-${index}`}><img src={image} alt={`Aufgabenbild ${index + 1}`} /><button type="button" aria-label={`Bild ${index + 1} entfernen`} onClick={() => setTaskImages((current) => current.filter((_, i) => i !== index))}><X /></button></div>)}<label className="task-image-add"><Camera /><span>Kamera</span><input type="file" accept="image/*" capture="environment" aria-label="Foto mit Kamera aufnehmen" onChange={(event) => { loadTaskImage(event.target.files?.[0]); event.target.value = ""; }} /></label><label className="task-image-add"><ImagePlus /><span>Galerie</span><input type="file" accept="image/*" aria-label="Bild aus Galerie auswählen" onChange={(event) => { loadTaskImage(event.target.files?.[0]); event.target.value = ""; }} /></label></div></div>
      <div className="field-block task-comments"><Label>Kommentare</Label>{taskComments.length === 0 && <p className="task-comment-empty">Noch keine Kommentare.</p>}{taskComments.map((comment) => <article className="task-comment" key={comment.id}><strong>{comment.author}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</time><p>{comment.text}</p></article>)}{identityChecking ? <small>Anmeldung wird geprüft.</small> : commentAuthor ? <small>Du schreibst als {commentAuthor}.</small> : <small>Für Kommentare muss dein angemeldetes Konto erkannt werden.</small>}<textarea aria-label="Kommentar" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Kommentar schreiben" disabled={!commentAuthor || identityChecking} rows={2} /><Button type="button" variant="outline" onClick={addTaskComment} disabled={!commentText.trim() || !commentAuthor || identityChecking}>Kommentar hinzufügen</Button><small>Der Kommentar wird beim Verlassen automatisch übernommen.</small></div>
    </div></div><SheetFooter className="editor-sheet-footer item-dialog-footer task-sheet-footer">{editingTaskId !== null && <Button className="delete-button" variant="outline" onClick={deleteTask}><Trash2 />Löschen</Button>}{editingTaskId !== null && <Button type="button" variant="outline" disabled={!taskTitle.trim()} onClick={() => { const task = tasks.find((entry) => entry.id === editingTaskId); if (task) { saveTask(); completeTask({ ...task, title: taskTitle.trim(), status: taskStatus }); } }}><Check />Erledigt</Button>}<Button type="button" onClick={saveTask} disabled={editingTaskId === null && !taskTitle.trim()}>{editingTaskId === null ? "Aufgabe anlegen" : "Schließen"}</Button></SheetFooter></SheetContent></Sheet>

    <Sheet open={laneDialog} onOpenChange={setLaneDialog}><SheetContent className="editor-sheet lane-editor-sheet" side="right" showCloseButton={false}><SheetHeader className="editor-sheet-header"><button className="editor-back" type="button" onClick={() => setLaneDialog(false)}><ArrowLeft />Aufgaben</button><SheetTitle>{editingLaneId ? "Bereich bearbeiten" : "Neuer Bereich"}</SheetTitle><SheetDescription className="sr-only">Name und Farbe des Aufgabenbereiches bearbeiten.</SheetDescription></SheetHeader><div className="editor-sheet-scroll"><div className="lane-editor-fields"><div className="field-block"><Label htmlFor="lane-title">Name</Label><Input id="lane-title" value={laneTitle} onChange={(event) => setLaneTitle(event.target.value)} placeholder="z. B. Diese Woche" autoFocus /></div><div className="field-block"><Label>Farbe</Label><div className="lane-color-picker">{laneColors.map((color) => <button type="button" className={laneColor === color ? "active" : ""} style={{ "--swatch-color": color } as CSSProperties} onClick={() => setLaneColor(color)} aria-label={`Farbe ${color} wählen`} key={color}><Check /></button>)}</div></div>{editingLaneId && <div className="lane-danger-zone"><div><strong>Bereich löschen</strong><span>{taskLanes.length > 1 ? `Enthaltene Aufgaben wechseln zu „${taskLanes.find((lane) => lane.id !== editingLaneId)?.title}“.` : "Mindestens ein Bereich muss erhalten bleiben."}</span></div><Button variant="outline" onClick={deleteLane} disabled={taskLanes.length < 2}><Trash2 />Löschen</Button></div>}</div></div><SheetFooter className="editor-sheet-footer"><Button onClick={saveLaneTitle} disabled={!laneTitle.trim()}>{editingLaneId ? "Änderungen speichern" : "Bereich anlegen"}</Button></SheetFooter></SheetContent></Sheet>

    <Dialog open={importDialog} onOpenChange={(open) => { if (open) openImportDialog(); else closeImportDialog(); }}><DialogContent className="import-dialog"><DialogHeader><DialogTitle>Rezept hinzufügen</DialogTitle><DialogDescription>Link, Text, Fotos oder PDFs erkennen lassen und das Ergebnis vor dem Speichern prüfen. Die Eingabe wird dafür an Gemini gesendet.</DialogDescription></DialogHeader><div className="import-options"><button className="import-option" type="button" onClick={() => openRecipeEditor()}><Pencil /><strong>Manuell eintragen</strong><span>Ohne KI</span></button><label className="import-option"><Camera /><strong>Foto aufnehmen</strong><span>Rezeptseite fotografieren</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => setImportFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} /></label><label className="import-option"><ImagePlus /><strong>Aus Galerie wählen</strong><span>Fotos oder Screenshots</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setImportFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} /></label><label className="import-option"><FileText /><strong>PDF wählen</strong><span>Rezept als PDF</span><input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => setImportFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} /></label></div><div className="import-input"><Label htmlFor="import-recipe-url">Link zur Rezeptseite</Label><Input id="import-recipe-url" type="url" inputMode="url" value={importUrl} onChange={(event) => setImportUrl(event.target.value)} placeholder="https://…" /><Label htmlFor="import-recipe-text">Rezepttext</Label><textarea id="import-recipe-text" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Rezepttext einfügen" rows={5} />{importFiles.length > 0 && <div className="import-files"><span>{importFiles.length} {importFiles.length === 1 ? "Datei" : "Dateien"} ausgewählt</span><button type="button" onClick={() => setImportFiles([])}>Dateien entfernen</button></div>}{importError && <p className="import-error" role="alert">{importError}</p>}</div><DialogFooter><Button onClick={importRecipe} disabled={importBusy || (!importText.trim() && !importUrl.trim() && importFiles.length === 0)}>{importBusy ? "Rezept wird erkannt …" : "Rezept erkennen"}</Button></DialogFooter></DialogContent></Dialog>

    <Sheet open={recipeEditor} onOpenChange={setRecipeEditor}><SheetContent className="editor-sheet recipe-editor-sheet" side="right" showCloseButton={false}><SheetHeader className="editor-sheet-header"><button className="editor-back" type="button" onClick={() => setRecipeEditor(false)}><ArrowLeft />Kochbuch</button><SheetTitle>{recipeDraft.id ? "Rezept bearbeiten" : "Rezept anlegen"}</SheetTitle><SheetDescription className="sr-only">Rezeptdaten und Zubereitung bearbeiten.</SheetDescription></SheetHeader><div className="editor-sheet-scroll recipe-editor-scroll">
      <label className="recipe-image-picker">{recipeDraft.image ? <img src={recipeDraft.image} alt="Rezeptvorschau" /> : <ImagePlus />}<span>{recipeDraft.image ? "Bild ändern" : "Rezeptfoto hinzufügen"}</span><input type="file" accept="image/*" onChange={(event) => { loadRecipeImage(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <div className="recipe-image-actions">{sourceRecipeImage && <Button type="button" variant="outline" onClick={() => setCropSource(sourceRecipeImage)}><ImagePlus />Titelbild der Quelle übernehmen</Button>}<Button type="button" variant="outline" disabled title="Für KI-Bilder benötigt das Gemini-Projekt einen bezahlten Tarif mit Bildmodell-Zugriff."><Sparkles />KI-Bild erstellen</Button></div>
      <p className="recipe-image-hint">KI-Bilder benötigen ein Gemini-Projekt mit aktivierter Abrechnung. Diese Funktion ist noch nicht verbunden.</p>
      <div className="recipe-editor-grid"><div className="field-block wide"><Label htmlFor="recipe-title">Name</Label><Input id="recipe-title" value={recipeDraft.title} onChange={(event) => setRecipeDraft((current) => ({ ...current, title: event.target.value }))} placeholder="z. B. Gemüse-Lasagne" /></div><div className="field-block wide"><Label htmlFor="recipe-description">Kurzbeschreibung</Label><textarea id="recipe-description" value={recipeDraft.description} onChange={(event) => setRecipeDraft((current) => ({ ...current, description: event.target.value }))} rows={2} placeholder="Was macht das Rezept besonders?" /></div>
        <div className="field-block"><div className="optional-field-heading"><Label>Dauer</Label><button type="button" disabled={recipeDraft.minutes === null} aria-label="Dauer entfernen" onClick={() => setRecipeDraft((current) => ({ ...current, minutes: null }))}><X /></button></div><div className="stepper optional-stepper"><button type="button" disabled={recipeDraft.minutes === null} aria-label="Dauer verringern" onClick={() => setRecipeDraft((current) => ({ ...current, minutes: current.minutes === null ? null : Math.max(1, current.minutes - 5) }))}><Minus /></button><strong>{recipeDraft.minutes === null ? "Nicht angegeben" : `${recipeDraft.minutes} Min.`}</strong><button type="button" aria-label="Dauer erhöhen" onClick={() => setRecipeDraft((current) => ({ ...current, minutes: (current.minutes ?? 0) + 5 }))}><Plus /></button></div></div>
        <div className="field-block"><div className="optional-field-heading"><Label>Portionen</Label><button type="button" disabled={recipeDraft.servings === null} aria-label="Portionen entfernen" onClick={() => setRecipeDraft((current) => ({ ...current, servings: null }))}><X /></button></div><div className="stepper optional-stepper"><button type="button" disabled={recipeDraft.servings === null} aria-label="Portionen verringern" onClick={() => setRecipeDraft((current) => ({ ...current, servings: current.servings === null ? null : Math.max(1, current.servings - 1) }))}><Minus /></button><strong>{recipeDraft.servings ?? "Nicht angegeben"}</strong><button type="button" aria-label="Portionen erhöhen" onClick={() => setRecipeDraft((current) => ({ ...current, servings: (current.servings ?? 0) + 1 }))}><Plus /></button></div></div>
        <div className="field-block"><Label>Bereits zubereitet</Label><div className="stepper"><button type="button" aria-label="Zubereitungen verringern" onClick={() => setRecipeDraft((current) => ({ ...current, prepared: Math.max(0, current.prepared - 1) }))}><Minus /></button><strong>{recipeDraft.prepared}×</strong><button type="button" aria-label="Zubereitungen erhöhen" onClick={() => setRecipeDraft((current) => ({ ...current, prepared: current.prepared + 1 }))}><Plus /></button></div></div>
      </div>
      <div className="field-block"><Label>Kategorien</Label><div className="category-picker">{Array.from(new Set(["Frühstück", "Herzhaft", "Vegetarisch", "Kuchen", "Süß", "Brot", ...recipes.flatMap((recipe) => recipe.categories), ...customCategories, ...recipeDraft.categories])).map((entry) => <button type="button" className={recipeDraft.categories.includes(entry) ? "touch-chip active" : "touch-chip"} onClick={() => setRecipeDraft((current) => ({ ...current, categories: current.categories.includes(entry) ? current.categories.filter((item) => item !== entry) : [...current.categories, entry] }))} key={entry}>{entry}</button>)}</div><div className="category-entry"><Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Neue Kategorie" /><Button variant="outline" onClick={addDraftCategory} disabled={!newCategory.trim()}><Plus />Anlegen</Button></div></div>
      <details className="recipe-version-editor editor-section" open={editorSections.versions} onToggle={(event) => { const open = event.currentTarget.open; setEditorSections((current) => ({ ...current, versions: open })); }}><summary className="section-title"><h3>Rezeptversionen{activeDraftVersion ? ` · ${activeDraftVersion.title}` : ""}</h3><span>{recipeDraft.versions.length + 1}</span></summary><div className="recipe-version-tabs"><button type="button" className={!editingVersionId ? "active" : ""} onClick={() => switchDraftVersion(null)}>Grundrezept</button>{recipeDraft.versions.map((version) => <button type="button" className={editingVersionId === version.id ? "active" : ""} onClick={() => switchDraftVersion(version.id)} key={version.id}>{version.title}</button>)}<button type="button" onClick={addDraftVersion}><Plus />Variante</button></div>{activeDraftVersion && <div className="recipe-version-name"><div className="field-block"><Label htmlFor="recipe-version-title">Name der Variante</Label><Input id="recipe-version-title" value={activeDraftVersion.title} onChange={(event) => setRecipeDraft((current) => ({ ...current, versions: current.versions.map((version) => version.id === activeDraftVersion.id ? { ...version, title: event.target.value } : version) }))} placeholder="z. B. Mit Sahne" /></div><Button type="button" variant="outline" onClick={() => { setRecipeDraft((current) => ({ ...current, versions: current.versions.filter((version) => version.id !== activeDraftVersion.id) })); switchDraftVersion(null); }}><Trash2 />Variante löschen</Button></div>}</details>
      <details className="draft-ingredients editor-section" open={editorSections.ingredients} onToggle={(event) => { const open = event.currentTarget.open; setEditorSections((current) => ({ ...current, ingredients: open })); }}><summary className="section-title"><h3>Zutaten</h3><span>{draftIngredients.length}</span></summary><div className="editor-section-content">{draftIngredients.map((ingredient) => <div className={`draft-ingredient ${editingIngredientId === ingredient.id ? "draft-ingredient--editing" : ""}`} key={ingredient.id}><ProductGlyph name={ingredient.name} quiet /><span><strong>{ingredient.name}</strong><small>{ingredient.detail}{ingredient.optional ? " · optional" : ""}{ingredient.pantry ? " · immer da" : ""}</small></span><button type="button" onClick={() => editDraftIngredient(ingredient)} aria-label={`${ingredient.name} bearbeiten`}><Pencil /></button><button type="button" onClick={() => { if (editingIngredientId === ingredient.id) resetIngredientEntry(); updateDraftContent((ingredients, steps) => ({ ingredients: ingredients.filter((item) => item.id !== ingredient.id), steps: steps.map((step) => ({ ...step, ingredientIds: step.ingredientIds.filter((id) => id !== ingredient.id) })) })); }} aria-label={`${ingredient.name} entfernen`}><X /></button></div>)}<div className="ingredient-entry" id="recipe-ingredient-entry"><Input className="ingredient-name-input" aria-label="Zutat" value={ingredientName} onChange={(event) => setIngredientName(event.target.value)} placeholder="Zutat" /><div className="field-block"><Label htmlFor="ingredient-amount">Menge</Label><Input id="ingredient-amount" type="text" inputMode="decimal" value={ingredientAmount} onChange={(event) => setIngredientAmount(event.target.value)} placeholder="z. B. 250" aria-invalid={Boolean(ingredientAmount.trim() && parsePositiveAmount(ingredientAmount) === null)} /></div><div className="field-block"><Label>Einheit</Label><div className="unit-picker ingredient-unit-picker">{shoppingUnits.map((unit) => <button type="button" className={ingredientUnit === unit ? "active" : ""} onClick={() => setIngredientUnit(unit)} key={unit}>{unit}</button>)}</div></div><Input className="ingredient-detail-input" aria-label="Typ oder weitere Angabe" value={ingredientDetail} onChange={(event) => setIngredientDetail(event.target.value)} placeholder="Typ / weitere Angabe, z. B. festkochend" /><div className="ingredient-flags"><label><Checkbox checked={ingredientOptional} onCheckedChange={(checked) => setIngredientOptional(Boolean(checked))} />Optional</label><label><Checkbox checked={ingredientPantry} onCheckedChange={(checked) => setIngredientPantry(Boolean(checked))} />Immer da</label></div><div className="ingredient-entry-actions">{editingIngredientId && <Button variant="ghost" onClick={resetIngredientEntry}>Abbrechen</Button>}<Button variant="outline" onClick={addDraftIngredient} disabled={!ingredientName.trim() || Boolean(ingredientAmount.trim() && parsePositiveAmount(ingredientAmount) === null)}>{editingIngredientId ? <Check /> : <Plus />}{editingIngredientId ? "Änderung übernehmen" : "Zutat hinzufügen"}</Button></div></div></div></details>
      <details className="draft-steps editor-section" open={editorSections.steps} onToggle={(event) => { const open = event.currentTarget.open; setEditorSections((current) => ({ ...current, steps: open })); }}><summary className="section-title"><h3>Zubereitung</h3><span>{draftSteps.length} Schritte</span></summary><div className="editor-section-content">
        {draftSteps.map((step, index) => <div className="draft-step" key={step.id}><strong>{index + 1}</strong><div className="draft-step-body">
          <textarea aria-label={`Anweisung für Schritt ${index + 1}`} value={step.text} onChange={(event) => updateDraftContent((ingredients, steps) => ({ ingredients, steps: steps.map((entry) => entry.id === step.id ? { ...entry, text: event.target.value } : entry) }))} rows={2} />
          <span className="step-field-label">Eingaben</span><div className="step-ingredients">{draftIngredients.map((ingredient) => <button type="button" key={ingredient.id} className={step.ingredientIds.includes(ingredient.id) ? "touch-chip active" : "touch-chip"} onClick={() => updateDraftContent((ingredients, steps) => ({ ingredients, steps: steps.map((entry) => entry.id === step.id ? { ...entry, ingredientIds: entry.ingredientIds.includes(ingredient.id) ? entry.ingredientIds.filter((id) => id !== ingredient.id) : [...entry.ingredientIds, ingredient.id] } : entry) }))}>{ingredient.name}</button>)}{draftSteps.slice(0, index).filter((previous) => previous.output?.trim()).map((previous) => <button type="button" key={previous.id} className={(step.inputStepIds ?? []).includes(previous.id) ? "touch-chip active step-result-chip" : "touch-chip step-result-chip"} onClick={() => updateDraftContent((ingredients, steps) => ({ ingredients, steps: steps.map((entry) => entry.id === step.id ? { ...entry, inputStepIds: (entry.inputStepIds ?? []).includes(previous.id) ? (entry.inputStepIds ?? []).filter((id) => id !== previous.id) : [...(entry.inputStepIds ?? []), previous.id] } : entry) }))}>{previous.output}</button>)}</div>
          <div className="step-amount-fields">{draftIngredients.filter((ingredient) => step.ingredientIds.includes(ingredient.id)).map((ingredient) => <label key={ingredient.id}>{ingredient.name}<Input aria-label={`Menge für ${ingredient.name} in Schritt ${index + 1}`} value={step.ingredientAmounts?.[ingredient.id] ?? ""} placeholder="Teilmenge, z. B. 50 g" onChange={(event) => updateDraftContent((ingredients, steps) => ({ ingredients, steps: steps.map((entry) => entry.id === step.id ? { ...entry, ingredientAmounts: { ...entry.ingredientAmounts, [ingredient.id]: event.target.value } } : entry) }))} /></label>)}</div>
          <Label className="step-field-label" htmlFor={`step-output-${step.id}`}>Ergebnis dieses Schritts</Label><Input id={`step-output-${step.id}`} value={step.output ?? ""} onChange={(event) => updateDraftContent((ingredients, steps) => ({ ingredients, steps: normalizeStepLinks(steps.map((entry) => entry.id === step.id ? { ...entry, output: event.target.value } : entry)) }))} placeholder="z. B. Teig" maxLength={100} />
        </div><div className="draft-step-actions"><button type="button" disabled={index === 0} onClick={() => moveDraftStep(index, -1)} aria-label={`Schritt ${index + 1} nach oben`}><ArrowLeft /></button><button type="button" disabled={index === draftSteps.length - 1} onClick={() => moveDraftStep(index, 1)} aria-label={`Schritt ${index + 1} nach unten`}><ArrowRight /></button><button type="button" onClick={() => updateDraftContent((ingredients, steps) => ({ ingredients, steps: normalizeStepLinks(steps.filter((entry) => entry.id !== step.id)) }))} aria-label={`Schritt ${index + 1} löschen`}><Trash2 /></button></div></div>)}
        <div className="new-step"><Label htmlFor="new-step-text">Neuer Schritt</Label><textarea id="new-step-text" value={stepText} onChange={(event) => setStepText(event.target.value)} rows={2} placeholder="Was passiert als Nächstes?" /><span className="step-field-label">Eingaben</span><div className="step-ingredients">{draftIngredients.map((ingredient) => <button type="button" key={ingredient.id} className={stepIngredientIds.includes(ingredient.id) ? "touch-chip active" : "touch-chip"} onClick={() => setStepIngredientIds((current) => current.includes(ingredient.id) ? current.filter((id) => id !== ingredient.id) : [...current, ingredient.id])}>{ingredient.name}</button>)}{draftSteps.filter((previous) => previous.output?.trim()).map((previous) => <button type="button" key={previous.id} className={stepInputStepIds.includes(previous.id) ? "touch-chip active step-result-chip" : "touch-chip step-result-chip"} onClick={() => setStepInputStepIds((current) => current.includes(previous.id) ? current.filter((id) => id !== previous.id) : [...current, previous.id])}>{previous.output}</button>)}</div><Label htmlFor="new-step-output">Ergebnis dieses Schritts</Label><Input id="new-step-output" value={stepOutput} onChange={(event) => setStepOutput(event.target.value)} placeholder="z. B. Teig" maxLength={100} /><Button variant="outline" onClick={addDraftStep} disabled={!stepText.trim()}><Plus />Schritt hinzufügen</Button></div>
      </div></details>
    </div><SheetFooter className="editor-sheet-footer item-dialog-footer">{recipeDraft.id && <Button className="delete-button" variant="outline" onClick={() => setDeleteRecipeDialog(true)}><Trash2 />Rezept löschen</Button>}<Button onClick={saveRecipe} disabled={!recipeDraft.title.trim() || Boolean(editingIngredientId && (!ingredientName.trim() || (ingredientAmount.trim() && parsePositiveAmount(ingredientAmount) === null)))}>{recipeDraft.id ? "Rezept speichern" : "Rezept anlegen"}</Button></SheetFooter></SheetContent></Sheet>
    {cropSource && <RecipeImageCrop source={cropSource} onCancel={() => setCropSource(null)} onApply={(image) => { setRecipeDraft((current) => ({ ...current, image })); setCropSource(null); }} />}
    <AlertDialog open={deleteRecipeDialog} onOpenChange={setDeleteRecipeDialog}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Rezept löschen?</AlertDialogTitle><AlertDialogDescription>„{recipeDraft.title}“ wird aus deinem Kochbuch entfernt. Das kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteRecipe}>Rezept löschen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}><DialogContent className="add-dialog"><DialogHeader><DialogTitle>Neue Kategorie</DialogTitle><DialogDescription>Ein kurzer Name macht sie später leicht auffindbar.</DialogDescription></DialogHeader><div className="dialog-fields"><div><Label htmlFor="category-name">Name</Label><Input id="category-name" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="z. B. Feierabend" autoFocus /></div></div><DialogFooter><Button onClick={createCategory} disabled={!newCategory.trim()}>Kategorie anlegen</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={pantryDialog} onOpenChange={setPantryDialog}><DialogContent className="add-dialog"><DialogHeader><DialogTitle>Immer da bearbeiten</DialogTitle><DialogDescription>Diese Produkte werden beim Rezeptimport automatisch markiert.</DialogDescription></DialogHeader><div className="pantry-editor-list">{pantry.map((item) => <div className="pantry-editor-item" key={item.id}><ProductGlyph name={item.name} quiet /><span>{item.name}</span><button type="button" onClick={() => setPantry((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`${item.name} aus Immer da entfernen`}><Trash2 /></button></div>)}</div><div className="pantry-editor-add"><Input aria-label="Produkt für Immer da" value={pantryName} onChange={(event) => setPantryName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addPantryProduct(); }} placeholder="Produktname" /><Button type="button" onClick={addPantryProduct} disabled={!pantryName.trim() || pantry.some((item) => productKey(item.name) === productKey(pantryName))}><Plus />Hinzufügen</Button></div></DialogContent></Dialog>

    <Sheet open={Boolean(selectedRecipe)} onOpenChange={(open) => !open && setSelectedRecipeId(null)}><SheetContent className="recipe-sheet" side="right" showCloseButton={false}>
      {selectedRecipe && <><div className="recipe-sheet-scroll recipe-sheet-scroll--full"><div className={`sheet-hero ${selectedRecipe.image ? "has-image" : ""}`}><button className="recipe-back" type="button" onClick={() => setSelectedRecipeId(null)}><ArrowLeft />Kochbuch</button>{selectedRecipe.image ? <button className="recipe-image-open" type="button" aria-label={`Bild von ${selectedRecipe.title} vergrößern`} onClick={() => setRecipeImageOpen(true)}><img src={selectedRecipe.image} alt="" /></button> : (() => { const Icon = recipeIcons[selectedRecipe.icon]; return <Icon />; })()}</div>
        <SheetHeader className="recipe-sheet-header"><div className="sheet-title-row"><div><div className="recipe-tags">{selectedRecipe.categories.map((entry) => <span key={entry}>{entry}</span>)}</div><SheetTitle>{selectedRecipe.title}</SheetTitle></div><div className="detail-actions"><button className="detail-edit" type="button" onClick={() => openRecipeEditor(selectedRecipe)}><Pencil /><span className="sr-only">Rezept bearbeiten</span></button><button className={`detail-favorite ${selectedRecipe.favorite ? "active" : ""}`} type="button" onClick={() => patchRecipe(selectedRecipe.id, { favorite: !selectedRecipe.favorite })}><Heart /><span className="sr-only">Lieblingsrezept umschalten</span></button></div></div><SheetDescription>{selectedRecipe.description}</SheetDescription><RecipeSourceLine recipe={selectedRecipe} /></SheetHeader>
        {(selectedRecipe.versions?.length ?? 0) > 0 && <div className="recipe-version-tabs recipe-version-tabs--detail" aria-label="Rezeptversion wählen"><button type="button" className={selectedVersionIds.length === 0 ? "active" : ""} onClick={() => chooseRecipeVersion(null)}>Grundrezept</button>{selectedRecipe.versions?.map((version) => <button type="button" aria-pressed={selectedVersionIds.includes(version.id)} className={selectedVersionIds.includes(version.id) ? "active" : ""} onClick={() => chooseRecipeVersion(version.id)} key={version.id}>{version.title}</button>)}</div>}{selectedVersionIds.length > 1 && <p className="recipe-combination-note">{selectedVersionIds.length} Varianten kombiniert</p>}{(selectedRecipe.minutes != null || selectedRecipe.servings != null) && <div className="detail-meta">{selectedRecipe.minutes != null && <span><Clock3 />{selectedRecipe.minutes} Min.</span>}{baseServings !== null && shownServings !== null && <div className="recipe-portions" role="group" aria-label="Portionen anpassen"><button type="button" aria-label="Portionen verringern" disabled={shownServings <= 1} onClick={() => setRecipeServingsOverride(Math.max(1, shownServings - 1))}><Minus /></button><strong>{shownServings} Portionen</strong><button type="button" aria-label="Portionen erhöhen" disabled={shownServings >= 100} onClick={() => setRecipeServingsOverride(Math.min(100, shownServings + 1))}><Plus /></button></div>}</div>}
          <section className="rating-block"><div><span>Deine Bewertung</span><StarRating value={selectedRecipe.rating} onChange={(rating) => patchRecipe(selectedRecipe.id, { rating })} /></div><div className="made-count"><strong>{madeCount(selectedRecipe)}×</strong><span>zubereitet{selectedRecipe.lastPrepared ? ` · zuletzt ${selectedRecipe.lastPrepared}` : ""}</span></div></section>
          <section className="ingredient-section"><div className="section-title"><h3>Zutaten</h3>{shownServings !== null && <span>für {shownServings}</span>}</div>{recipeIngredients.map((ingredient) => <div className="ingredient-row" key={ingredient.id}><EditableProductGlyph name={ingredient.name} onEdit={() => openRecipeProductIcon(ingredient.name)} /><div><strong>{ingredient.name}</strong><span>{ingredient.detail}</span></div>{ingredient.pantry && <em>Immer da</em>}{ingredient.optional && <em>Optional</em>}</div>)}
          {servingFactor !== 1 && <p className="recipe-scaling-note">Zutatenmengen angepasst. Mengen im Zubereitungstext und nicht eindeutig erkennbare Angaben bitte prüfen.</p>}</section>
          {recipeSteps.length > 0 && <section className="recipe-method" aria-label="Rezeptübersicht"><div className="section-title"><h3>Zubereitung</h3><span>{recipeSteps.length} Schritte</span></div><div className="recipe-table">{recipeSteps.map((step, index) => <div className="recipe-table-row" key={step.id}><div className="recipe-table-ingredients"><span className="recipe-step-number">{index + 1}</span>{(step.inputStepIds ?? []).map((id) => recipeSteps.find((previous) => previous.id === id)).filter((previous): previous is RecipeStep => Boolean(previous?.output)).map((previous) => <div className="recipe-step-input" key={previous.id}><span>↳</span><strong>{previous.output}</strong></div>)}{step.ingredientIds.map((id) => recipeIngredients.find((ingredient) => ingredient.id === id)).filter((ingredient): ingredient is Ingredient => Boolean(ingredient)).map((ingredient) => <div className="recipe-table-ingredient" key={ingredient.id}><EditableProductGlyph name={ingredient.name} onEdit={() => openRecipeProductIcon(ingredient.name)} /><span><strong>{ingredient.name}</strong><small>{stepIngredientDetail(step, combinedRecipe?.ingredients.find((entry) => entry.id === ingredient.id) ?? ingredient, recipeSteps, servingFactor)}{ingredient.optional ? " · optional" : ""}</small></span></div>)}</div><div className="recipe-step-instruction"><HighlightedInstruction text={step.text} />{step.output && <div className="recipe-step-output"><span>Ergebnis</span><strong>{step.output}</strong></div>}</div></div>)}</div></section>}
        </div>
        <SheetFooter className="recipe-sheet-footer"><Button size="lg" onClick={openShoppingSelection}><ShoppingBasket />Zutaten einkaufen</Button><Button className="celebrate-button" size="lg" variant="outline" onClick={markPrepared}><PartyPopper />Geschafft!</Button></SheetFooter></>}
    </SheetContent></Sheet>

    <Dialog open={recipeImageOpen && Boolean(selectedRecipe?.image)} onOpenChange={setRecipeImageOpen}><DialogContent className="recipe-image-dialog" showCloseButton={false}><DialogTitle className="sr-only">Bild von {selectedRecipe?.title}</DialogTitle><DialogDescription className="sr-only">Erneut auf das Bild klicken, um zur Rezeptansicht zurückzukehren.</DialogDescription>{selectedRecipe?.image && <button type="button" className="recipe-image-close" onClick={() => setRecipeImageOpen(false)} aria-label="Bild schließen und zum Rezept zurückkehren"><img src={selectedRecipe.image} alt={selectedRecipe.title} /><span aria-hidden="true">Zum Schließen tippen</span></button>}</DialogContent></Dialog>

    <Sheet open={shoppingDialog} onOpenChange={setShoppingDialog}><SheetContent className="editor-sheet recipe-shopping-sheet" side="right" showCloseButton={false}><SheetHeader className="editor-sheet-header"><button className="editor-back" type="button" onClick={() => setShoppingDialog(false)}><ArrowLeft />Rezept</button><SheetTitle>Zutaten einkaufen</SheetTitle><SheetDescription className="sr-only">Zutaten für den Einkaufszettel auswählen.</SheetDescription></SheetHeader>{selectedRecipe && <div className="editor-sheet-scroll recipe-shopping-scroll">
      {(selectedRecipe.versions?.length ?? 0) > 0 && <div className="recipe-version-tabs recipe-version-tabs--detail" aria-label="Rezeptversion wählen"><button type="button" className={selectedVersionIds.length === 0 ? "active" : ""} onClick={() => chooseRecipeVersion(null)}>Grundrezept</button>{selectedRecipe.versions?.map((version) => <button type="button" aria-pressed={selectedVersionIds.includes(version.id)} className={selectedVersionIds.includes(version.id) ? "active" : ""} onClick={() => chooseRecipeVersion(version.id)} key={version.id}>{version.title}</button>)}</div>}
      {selectedVersionIds.length > 1 && <p className="recipe-combination-note">{selectedVersionIds.length} Varianten kombiniert</p>}
      <section className="recipe-selected-ingredients"><div className="section-title"><h3>Für den Einkaufszettel</h3><span>{chosenRecipeIngredients.length}</span></div>{chosenRecipeIngredients.length > 0 ? <div className="recipe-shopping-grid">{chosenRecipeIngredients.map((ingredient) => <RecipeIngredientTile key={ingredient.id} ingredient={ingredient} item={pendingRecipeItems[ingredient.id]} selected listMatch={shoppingNameMatch(ingredient)} onToggle={() => toggleRecipeIngredient(ingredient.id)} onEdit={() => openRecipeItemEditor(ingredient)} />)}</div> : <p className="recipe-selection-empty">Noch keine Zutaten ausgewählt.</p>}</section>
      <div className="recipe-shopping-shelves"><Shelf title="Optional" count={optionalRecipeIngredients.length} open={openRecipeShelves.optional} onOpenChange={(open) => setOpenRecipeShelves((current) => ({ ...current, optional: open }))}><div className="recipe-shopping-grid">{optionalRecipeIngredients.map((ingredient) => <RecipeIngredientTile key={ingredient.id} ingredient={ingredient} item={pendingRecipeItems[ingredient.id]} selected={false} listMatch={shoppingNameMatch(ingredient)} onToggle={() => toggleRecipeIngredient(ingredient.id)} onEdit={() => openRecipeItemEditor(ingredient)} />)}</div></Shelf><Shelf title="Immer da" count={pantryRecipeIngredients.length} open={openRecipeShelves.pantry} onOpenChange={(open) => setOpenRecipeShelves((current) => ({ ...current, pantry: open }))}><div className="recipe-shopping-grid">{pantryRecipeIngredients.map((ingredient) => <RecipeIngredientTile key={ingredient.id} ingredient={ingredient} item={pendingRecipeItems[ingredient.id]} selected={false} listMatch={shoppingNameMatch(ingredient)} onToggle={() => toggleRecipeIngredient(ingredient.id)} onEdit={() => openRecipeItemEditor(ingredient)} />)}</div></Shelf>{skippedRecipeIngredients.length > 0 && <Shelf title="Abgewählt" count={skippedRecipeIngredients.length} open={openRecipeShelves.skipped} onOpenChange={(open) => setOpenRecipeShelves((current) => ({ ...current, skipped: open }))}><div className="recipe-shopping-grid">{skippedRecipeIngredients.map((ingredient) => <RecipeIngredientTile key={ingredient.id} ingredient={ingredient} item={pendingRecipeItems[ingredient.id]} selected={false} listMatch={shoppingNameMatch(ingredient)} onToggle={() => toggleRecipeIngredient(ingredient.id)} onEdit={() => openRecipeItemEditor(ingredient)} />)}</div></Shelf>}</div>
    </div>}<SheetFooter className="editor-sheet-footer recipe-shopping-footer"><Button onClick={addRecipeIngredients} disabled={chosenRecipeIngredients.length === 0}><ShoppingBasket />{chosenRecipeIngredients.length} Zutaten hinzufügen</Button></SheetFooter></SheetContent></Sheet>
    {taskCelebration > 0 && <div key={taskCelebration} className="task-confetti" aria-hidden="true" onAnimationEnd={(event) => { if (event.target === event.currentTarget) setTaskCelebration(0); }}>{Array.from({ length: 14 }).map((_, index) => <i key={index} />)}</div>}
    {celebration && <div className="celebration" role="status"><div className="confetti" aria-hidden="true">{Array.from({ length: 18 }).map((_, index) => <i key={index} />)}</div><PartyPopper /><strong>Geschafft!</strong><span>Wieder etwas Leckeres auf den Tisch gebracht.</span></div>}
  </main></ProductIconContext.Provider>;
}




