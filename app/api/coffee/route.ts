import { env } from "cloudflare:workers";
import { householdIdentity } from "@/lib/household-auth";
import { createCoffeeService } from "@/lib/coffee-service";

export const dynamic = "force-dynamic";
export function GET(request: Request) { return createCoffeeService({ db: env.DB, identify: householdIdentity }).GET(request); }
export function PUT(request: Request) { return createCoffeeService({ db: env.DB, identify: householdIdentity }).PUT(request); }
