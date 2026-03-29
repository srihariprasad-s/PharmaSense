import { Router } from "express";
import { db, appointmentsTable, doctorsTable, patientsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Patient: create appointment request
router.post("/", requireRole("patient"), async (req, res) => {
  try {
    const { doctorId, requestedDate, requestedTime, patientNote } = req.body;

    const patients = await db.select().from(patientsTable).where(eq(patientsTable.userId, req.user!.userId)).limit(1);
    if (patients.length === 0) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const [apt] = await db.insert(appointmentsTable).values({
      patientId: patients[0].id,
      doctorId: parseInt(doctorId),
      requestedDate,
      requestedTime,
      patientNote: patientNote || null,
      status: "pending",
    }).returning();

    res.status(201).json(apt);
  } catch (err) {
    req.log.error({ err }, "Create appointment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Patient: get their appointments
router.get("/my", requireRole("patient"), async (req, res) => {
  try {
    const patients = await db.select().from(patientsTable).where(eq(patientsTable.userId, req.user!.userId)).limit(1);
    if (patients.length === 0) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const apts = await db.select({
      id: appointmentsTable.id,
      requestedDate: appointmentsTable.requestedDate,
      requestedTime: appointmentsTable.requestedTime,
      patientNote: appointmentsTable.patientNote,
      status: appointmentsTable.status,
      doctorNote: appointmentsTable.doctorNote,
      createdAt: appointmentsTable.createdAt,
      updatedAt: appointmentsTable.updatedAt,
      doctorName: usersTable.name,
      doctorSpecialty: doctorsTable.specialty,
    })
      .from(appointmentsTable)
      .innerJoin(doctorsTable, eq(appointmentsTable.doctorId, doctorsTable.id))
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(eq(appointmentsTable.patientId, patients[0].id))
      .orderBy(desc(appointmentsTable.createdAt));

    res.json(apts.map(a => ({ ...a, createdAt: a.createdAt?.toISOString(), updatedAt: a.updatedAt?.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Get patient appointments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Doctor: get their appointment requests
router.get("/doctor", requireRole("doctor"), async (req, res) => {
  try {
    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const apts = await db.select({
      id: appointmentsTable.id,
      requestedDate: appointmentsTable.requestedDate,
      requestedTime: appointmentsTable.requestedTime,
      patientNote: appointmentsTable.patientNote,
      status: appointmentsTable.status,
      doctorNote: appointmentsTable.doctorNote,
      createdAt: appointmentsTable.createdAt,
      updatedAt: appointmentsTable.updatedAt,
      patientName: usersTable.name,
      patientId: patientsTable.id,
    })
      .from(appointmentsTable)
      .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
      .innerJoin(usersTable, eq(patientsTable.userId, usersTable.id))
      .where(eq(appointmentsTable.doctorId, doctors[0].id))
      .orderBy(desc(appointmentsTable.createdAt));

    res.json(apts.map(a => ({ ...a, createdAt: a.createdAt?.toISOString(), updatedAt: a.updatedAt?.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Get doctor appointments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Doctor: respond to appointment (approve/reject with note)
router.put("/:id/respond", requireRole("doctor"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, doctorNote } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status must be approved or rejected" });
      return;
    }

    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const [updated] = await db.update(appointmentsTable)
      .set({ status, doctorNote: doctorNote || null, updatedAt: new Date() })
      .where(and(eq(appointmentsTable.id, id), eq(appointmentsTable.doctorId, doctors[0].id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Respond to appointment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
