import { env } from "cloudflare:workers";
import { householdIdentity } from "@/lib/household-auth";
import { createHouseholdService } from "@/lib/household-service";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return createHouseholdService({ db: env.DB, identify: householdIdentity, commentAuthors: env.NEST_COMMENT_AUTHORS }).GET(request);
}
export function PUT(request: Request) {
  return createHouseholdService({ db: env.DB, identify: householdIdentity, commentAuthors: env.NEST_COMMENT_AUTHORS }).PUT(request);
}
