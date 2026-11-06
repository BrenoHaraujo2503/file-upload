import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const file = pgTable("files", {
  id: text("id")
    .$defaultFn(() => createId()),
  name: text("name"),
  key: text("key"),
  contentType: text("content_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})
