ALTER TABLE push_subscription ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE push_subscription ADD COLUMN shopping_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_subscription ADD COLUMN shopping_since INTEGER NOT NULL DEFAULT 0;
