import { pgTable, serial, integer, text, timestamp, boolean, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "nmc_verified",
  "manually_approved",
  "rejected",
]);

export const doctorsTable = pgTable("doctors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull().unique(),
  registrationNumber: text("registration_number").notNull(),
  fatherName: text("father_name").notNull(),
  year: text("year").notNull(),
  stateCouncil: text("state_council").notNull(),
  phone: text("phone"),
  specialty: text("specialty"),
  subSpecialty: text("sub_specialty"),
  languages: text("languages").array(),
  regions: text("regions").array(),
  experience: integer("experience"),
  education: text("education"),
  bio: text("bio"),
  consultationFee: real("consultation_fee").default(500),
  symptoms: text("symptoms").array(),
  isOnline: boolean("is_online").default(false).notNull(),
  nmcVerified: boolean("nmc_verified").default(false).notNull(),
  verificationStatus: verificationStatusEnum("verification_status").default("pending").notNull(),
  rejectionReason: text("rejection_reason"),
  rating: real("rating").default(0),
  totalConsultations: integer("total_consultations").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctorsTable.$inferSelect;
