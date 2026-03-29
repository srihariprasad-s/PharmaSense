import { pgTable, serial, integer, text, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { doctorsTable } from "./doctors";
import { patientsTable } from "./patients";

export const consultationStatusEnum = pgEnum("consultation_status", [
  "pending",
  "accepted",
  "rejected",
  "payment_pending",
  "paid",
  "in_progress",
  "completed",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "unpaid",
  "pending",
  "paid",
  "refunded",
]);

export const consultationsTable = pgTable("consultations", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  doctorId: integer("doctor_id").references(() => doctorsTable.id).notNull(),
  symptoms: text("symptoms").notNull(),
  notes: text("notes"),
  status: consultationStatusEnum("status").default("pending").notNull(),
  rejectionReason: text("rejection_reason"),
  paymentStatus: paymentStatusEnum("payment_status").default("unpaid").notNull(),
  paymentAmount: real("payment_amount"),
  roomId: text("room_id"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConsultationSchema = createInsertSchema(consultationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertConsultation = z.infer<typeof insertConsultationSchema>;
export type Consultation = typeof consultationsTable.$inferSelect;
