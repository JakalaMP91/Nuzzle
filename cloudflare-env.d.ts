declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    NEST_ACCESS_TEAM_DOMAIN?: string;
    NEST_ACCESS_AUDIENCE?: string;
    NEST_ALLOWED_EMAILS?: string;
    NEST_COMMENT_AUTHORS?: string;
    NEST_VAPID_PUBLIC_KEY?: string;
    NEST_VAPID_PRIVATE_KEY?: string;
    NEST_VAPID_SUBJECT?: string;
  }
}
