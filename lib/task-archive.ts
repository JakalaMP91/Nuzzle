export type RestoreLane = { id: string; title: string; color: string };
export function resolveRestoreLane(status: string, lanes: RestoreLane[], newId: string, color: string): { status: string; newLane?: RestoreLane } {
  if (lanes.some((lane) => lane.id === status)) return { status };
  const existing = lanes.find((lane) => lane.title === "Unbekannt");
  return existing ? { status: existing.id } : { status: newId, newLane: { id: newId, title: "Unbekannt", color } };
}
