import { env } from "cloudflare:workers";
import { householdIdentity } from "@/lib/household-auth";
import { createIdentityService } from "@/lib/household-identity";

export const dynamic = "force-dynamic";
export const GET = createIdentityService(householdIdentity, () => env.NEST_COMMENT_AUTHORS);
