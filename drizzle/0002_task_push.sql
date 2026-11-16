CREATE TABLE IF NOT EXISTS push_subscription (
  endpoint text PRIMARY KEY NOT NULL,
  author text NOT NULL,
  subscription text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  last_test_at integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS push_subscription_author ON push_subscription(author);
CREATE TABLE IF NOT EXISTS push_delivery (
  endpoint text NOT NULL,
  notification_key text NOT NULL,
  attempted_at integer NOT NULL,
  sent integer NOT NULL DEFAULT 0,
  PRIMARY KEY(endpoint, notification_key)
);
