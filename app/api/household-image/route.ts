import { env } from "cloudflare:workers";
import { householdIdentity } from "@/lib/household-auth";
import { createHouseholdImageService } from "@/lib/household-image-service";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return createHouseholdImageService({ db: env.DB, identify: householdIdentity }).GET(request);
}
export function POST(request: Request) {
  return createHouseholdImageService({ db: env.DB, identify: householdIdentity }).POST(request);
}
