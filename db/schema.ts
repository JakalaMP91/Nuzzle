import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One private household. Updates use a revision as an optimistic lock.
export const household = sqliteTable("household", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const householdImage = sqliteTable("household_image", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const coffeeCollection = sqliteTable("coffee_collection", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
