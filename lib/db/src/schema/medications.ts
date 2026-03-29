import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { consultationsTable } from "./consultations";

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
]);

export const medicationOrdersTable = pgTable("medication_orders", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id").references(() => consultationsTable.id).notNull(),
  medications: text("medications").array().notNull(),
  instructions: text("instructions"),
  pharmacyName: text("pharmacy_name"),
  deliveryStatus: deliveryStatusEnum("delivery_status").default("pending").notNull(),
  deliveryNote: text("delivery_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMedicationOrderSchema = createInsertSchema(medicationOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMedicationOrder = z.infer<typeof insertMedicationOrderSchema>;
export type MedicationOrder = typeof medicationOrdersTable.$inferSelect;
