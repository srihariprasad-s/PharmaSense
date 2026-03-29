import { Router } from "express";
import { db, patientsTable, usersTable, consultationsTable, doctorsTable, prescriptionsTable, medicationOrdersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireRole } from "../middlewares/auth";

const router = Router();

router.get("/profile", requireRole("patient"), async (req, res) => {
  try {
    const patients = await db
      .select({
        id: patientsTable.id,
        userId: patientsTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        phone: patientsTable.phone,
        dateOfBirth: patientsTable.dateOfBirth,
        gender: patientsTable.gender,
        language: patientsTable.language,
        region: patientsTable.region,
        bloodGroup: patientsTable.bloodGroup,
        allergies: patientsTable.allergies,
        medicalHistory: patientsTable.medicalHistory,
      })
      .from(patientsTable)
      .innerJoin(usersTable, eq(patientsTable.userId, usersTable.id))
      .where(eq(patientsTable.userId, req.user!.userId))
      .limit(1);

    if (patients.length === 0) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    res.json(patients[0]);
  } catch (err) {
    req.log.error({ err }, "Get patient profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", requireRole("patient"), async (req, res) => {
  try {
    const { name, phone, dateOfBirth, gender, language, region, bloodGroup, allergies, medicalHistory } = req.body;

    if (name) {
      await db.update(usersTable).set({ name, updatedAt: new Date() }).where(eq(usersTable.id, req.user!.userId));
    }

    const [updated] = await db.update(patientsTable)
      .set({
        phone,
        dateOfBirth,
        gender,
        language,
        region,
        bloodGroup,
        allergies,
        medicalHistory,
        updatedAt: new Date(),
      })
      .where(eq(patientsTable.userId, req.user!.userId))
      .returning();

    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);

    res.json({
      id: updated.id,
      userId: updated.userId,
      name: user[0].name,
      email: user[0].email,
      phone: updated.phone,
      dateOfBirth: updated.dateOfBirth,
      gender: updated.gender,
      language: updated.language,
      region: updated.region,
      bloodGroup: updated.bloodGroup,
      allergies: updated.allergies,
      medicalHistory: updated.medicalHistory,
    });
  } catch (err) {
    req.log.error({ err }, "Update patient profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/consultations", requireRole("patient"), async (req, res) => {
  try {
    const patients = await db.select().from(patientsTable).where(eq(patientsTable.userId, req.user!.userId)).limit(1);
    if (patients.length === 0) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const consultations = await db
      .select({
        id: consultationsTable.id,
        doctorId: consultationsTable.doctorId,
        doctorName: usersTable.name,
        specialty: doctorsTable.specialty,
        symptoms: consultationsTable.symptoms,
        status: consultationsTable.status,
        paymentStatus: consultationsTable.paymentStatus,
        createdAt: consultationsTable.createdAt,
        completedAt: consultationsTable.completedAt,
      })
      .from(consultationsTable)
      .innerJoin(doctorsTable, eq(consultationsTable.doctorId, doctorsTable.id))
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(eq(consultationsTable.patientId, patients[0].id))
      .orderBy(sql`${consultationsTable.createdAt} DESC`);

    res.json(consultations);
  } catch (err) {
    req.log.error({ err }, "Get patient consultations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/records", requireRole("patient"), async (req, res) => {
  try {
    const patients = await db.select().from(patientsTable).where(eq(patientsTable.userId, req.user!.userId)).limit(1);
    if (patients.length === 0) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const consultations = await db
      .select({
        id: consultationsTable.id,
        doctorId: consultationsTable.doctorId,
        doctorName: usersTable.name,
        specialty: doctorsTable.specialty,
        symptoms: consultationsTable.symptoms,
        status: consultationsTable.status,
        createdAt: consultationsTable.createdAt,
        completedAt: consultationsTable.completedAt,
      })
      .from(consultationsTable)
      .innerJoin(doctorsTable, eq(consultationsTable.doctorId, doctorsTable.id))
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(eq(consultationsTable.patientId, patients[0].id))
      .orderBy(sql`${consultationsTable.createdAt} DESC`);

    const records = await Promise.all(consultations.map(async c => {
      const prescs = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.consultationId, c.id));
      const meds = await db.select().from(medicationOrdersTable).where(eq(medicationOrdersTable.consultationId, c.id));
      
      return {
        id: c.id,
        consultationId: c.id,
        doctorName: c.doctorName,
        specialty: c.specialty,
        symptoms: c.symptoms,
        date: c.createdAt?.toISOString(),
        prescriptions: prescs.map(p => ({
          id: p.id,
          consultationId: p.consultationId,
          content: p.content,
          documentUrl: p.documentUrl,
          notes: p.notes,
          createdAt: p.createdAt?.toISOString(),
        })),
        medications: meds.map(m => ({
          id: m.id,
          consultationId: m.consultationId,
          medications: m.medications,
          instructions: m.instructions,
          pharmacyName: m.pharmacyName,
          deliveryStatus: m.deliveryStatus,
          createdAt: m.createdAt?.toISOString(),
          updatedAt: m.updatedAt?.toISOString(),
        })),
      };
    }));

    res.json(records);
  } catch (err) {
    req.log.error({ err }, "Get patient records error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
