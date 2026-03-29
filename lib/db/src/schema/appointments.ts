import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { doctorsTable } from "./doctors";

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "approved",
  "rejected",
  "completed",
]);

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patientsTable.id),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id),
  requestedDate: text("requested_date").notNull(),
  requestedTime: text("requested_time").notNull(),
  patientNote: text("patient_note"),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  doctorNote: text("doctor_note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
