import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";

export const webrtcSignalsTable = pgTable("webrtc_signals", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id").references(() => consultationsTable.id).notNull(),
  fromRole: text("from_role").notNull(),
  toRole: text("to_role").notNull(),
  signal: text("signal").notNull(),
  consumed: boolean("consumed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WebrtcSignal = typeof webrtcSignalsTable.$inferSelect;
