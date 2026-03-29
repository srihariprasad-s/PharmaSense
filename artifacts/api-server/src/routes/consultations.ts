import { Router } from "express";
import { db, consultationsTable, doctorsTable, patientsTable, usersTable, prescriptionsTable, medicationOrdersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { randomBytes } from "crypto";

const router = Router();

// Lazy Stripe loader - only load if key is present
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const { default: Stripe } = require("stripe");
    return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  } catch {
    return null;
  }
}

router.post("/request", requireAuth, async (req, res) => {
  try {
    if (req.user!.role !== "patient") {
      res.status(403).json({ error: "Only patients can request consultations" });
      return;
    }

    const { doctorId, symptoms, notes } = req.body;

    if (!doctorId || !symptoms) {
      res.status(400).json({ error: "doctorId and symptoms are required" });
      return;
    }

    const patients = await db.select().from(patientsTable).where(eq(patientsTable.userId, req.user!.userId)).limit(1);
    if (patients.length === 0) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.id, doctorId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const [consultation] = await db.insert(consultationsTable).values({
      patientId: patients[0].id,
      doctorId,
      symptoms,
      notes,
      status: "pending",
      paymentStatus: "unpaid",
    }).returning();

    res.status(201).json({
      id: consultation.id,
      patientId: consultation.patientId,
      doctorId: consultation.doctorId,
      symptoms: consultation.symptoms,
      notes: consultation.notes,
      status: consultation.status,
      createdAt: consultation.createdAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Create consultation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id/respond", requireAuth, async (req, res) => {
  try {
    if (req.user!.role !== "doctor") {
      res.status(403).json({ error: "Only doctors can respond to consultations" });
      return;
    }

    const id = parseInt(req.params.id);
    const { status, reason } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      res.status(400).json({ error: "Status must be accepted or rejected" });
      return;
    }

    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const consultations = await db.select().from(consultationsTable)
      .where(and(eq(consultationsTable.id, id), eq(consultationsTable.doctorId, doctors[0].id)))
      .limit(1);

    if (consultations.length === 0) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    const [updated] = await db.update(consultationsTable)
      .set({
        status: status as any,
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(consultationsTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      patientId: updated.patientId,
      doctorId: updated.doctorId,
      symptoms: updated.symptoms,
      status: updated.status,
      reason: updated.rejectionReason,
      createdAt: updated.createdAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Respond to consultation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create payment — supports real Stripe if keys configured, else sandbox
router.post("/:id/payment", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const consultations = await db.select().from(consultationsTable).where(eq(consultationsTable.id, id)).limit(1);
    if (consultations.length === 0) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    const consultation = consultations[0];
    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.id, consultation.doctorId)).limit(1);
    const fee = doctors[0]?.consultationFee ?? 500;

    await db.update(consultationsTable)
      .set({ paymentStatus: "pending", paymentAmount: fee, updatedAt: new Date() })
      .where(eq(consultationsTable.id, id));

    const stripe = getStripe();

    if (stripe) {
      // Real Stripe PaymentIntent
      const paymentIntent = await (stripe as any).paymentIntents.create({
        amount: Math.round(fee * 100), // paise/cents
        currency: "inr",
        metadata: { consultationId: String(id) },
        automatic_payment_methods: { enabled: true },
      });

      res.json({
        consultationId: id,
        amount: fee,
        currency: "INR",
        clientSecret: paymentIntent.client_secret,
        mode: "stripe",
      });
    } else {
      // Sandbox fallback
      const sessionId = `sandbox_${randomBytes(8).toString("hex")}`;
      res.json({
        consultationId: id,
        amount: fee,
        currency: "INR",
        sessionId,
        mode: "sandbox",
        message: "Sandbox payment — no Stripe keys configured.",
      });
    }
  } catch (err) {
    req.log.error({ err }, "Create payment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/payment/confirm", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const roomId = `room_${id}_${randomBytes(6).toString("hex")}`;

    await db.update(consultationsTable)
      .set({
        paymentStatus: "paid",
        status: "paid" as any,
        roomId,
        updatedAt: new Date(),
      })
      .where(eq(consultationsTable.id, id));

    res.json({ success: true, message: "Payment confirmed. You can now join the call." });
  } catch (err) {
    req.log.error({ err }, "Confirm payment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Patient full history — accessible by the doctor of this consultation
router.get("/:id/patient-history", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const consultations = await db.select().from(consultationsTable).where(eq(consultationsTable.id, id)).limit(1);
    if (consultations.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    const c = consultations[0];

    // Only the doctor for this consultation can view the history
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.id, c.doctorId)).limit(1) as any[];
    if (!doctor || doctor.userId !== req.user!.userId) {
      res.status(403).json({ error: "Access denied" }); return;
    }

    // Patient info
    const [patient] = await db
      .select({
        id: patientsTable.id, name: usersTable.name, email: usersTable.email,
        phone: patientsTable.phone, language: patientsTable.language, region: patientsTable.region,
        bloodGroup: patientsTable.bloodGroup, allergies: patientsTable.allergies, medicalHistory: patientsTable.medicalHistory,
      })
      .from(patientsTable)
      .innerJoin(usersTable, eq(patientsTable.userId, usersTable.id))
      .where(eq(patientsTable.id, c.patientId))
      .limit(1);

    // All consultations for this patient across all doctors, newest first
    const allConsultations = await db
      .select({
        id: consultationsTable.id,
        symptoms: consultationsTable.symptoms,
        notes: consultationsTable.notes,
        status: consultationsTable.status,
        createdAt: consultationsTable.createdAt,
        completedAt: consultationsTable.completedAt,
        doctorName: usersTable.name,
        doctorSpecialty: doctorsTable.specialty,
      })
      .from(consultationsTable)
      .innerJoin(doctorsTable, eq(consultationsTable.doctorId, doctorsTable.id))
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(and(eq(consultationsTable.patientId, c.patientId), sql`${consultationsTable.status} IN ('completed', 'in_progress', 'accepted', 'paid')`))
      .orderBy(sql`${consultationsTable.createdAt} DESC`);

    const enriched = await Promise.all(allConsultations.map(async (con) => {
      const prescs = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.consultationId, con.id));
      const meds = await db.select().from(medicationOrdersTable).where(eq(medicationOrdersTable.consultationId, con.id));
      return {
        ...con,
        createdAt: con.createdAt?.toISOString(),
        completedAt: con.completedAt?.toISOString(),
        prescriptions: prescs.map(p => ({ id: p.id, content: p.content, documentUrl: p.documentUrl, notes: p.notes, createdAt: p.createdAt?.toISOString() })),
        medications: meds.map(m => ({ id: m.id, medications: m.medications, instructions: m.instructions, pharmacyName: m.pharmacyName, deliveryStatus: m.deliveryStatus })),
      };
    }));

    res.json({ patient, consultations: enriched });
  } catch (err) {
    req.log.error({ err }, "Patient history error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const consultations = await db.select().from(consultationsTable).where(eq(consultationsTable.id, id)).limit(1);
    if (consultations.length === 0) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    const c = consultations[0];

    const [doctor] = await db
      .select({
        id: doctorsTable.id,
        userId: doctorsTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        specialty: doctorsTable.specialty,
        experience: doctorsTable.experience,
        consultationFee: doctorsTable.consultationFee,
        isOnline: doctorsTable.isOnline,
        verificationStatus: doctorsTable.verificationStatus,
      })
      .from(doctorsTable)
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(eq(doctorsTable.id, c.doctorId));

    const [patient] = await db
      .select({
        id: patientsTable.id,
        userId: patientsTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        phone: patientsTable.phone,
        language: patientsTable.language,
        region: patientsTable.region,
        bloodGroup: patientsTable.bloodGroup,
        allergies: patientsTable.allergies,
        medicalHistory: patientsTable.medicalHistory,
      })
      .from(patientsTable)
      .innerJoin(usersTable, eq(patientsTable.userId, usersTable.id))
      .where(eq(patientsTable.id, c.patientId));

    const prescs = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.consultationId, id));
    const meds = await db.select().from(medicationOrdersTable).where(eq(medicationOrdersTable.consultationId, id));

    res.json({
      id: c.id,
      patientId: c.patientId,
      doctorId: c.doctorId,
      symptoms: c.symptoms,
      notes: c.notes,
      status: c.status,
      paymentStatus: c.paymentStatus,
      roomId: c.roomId,
      createdAt: c.createdAt?.toISOString(),
      completedAt: c.completedAt?.toISOString(),
      doctor,
      patient,
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
        deliveryNote: (m as any).deliveryNote,
        createdAt: m.createdAt?.toISOString(),
        updatedAt: m.updatedAt?.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get consultation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id/complete", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const consultations = await db.select().from(consultationsTable).where(eq(consultationsTable.id, id)).limit(1);
    if (consultations.length === 0) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    await db.update(consultationsTable)
      .set({
        status: "completed" as any,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(consultationsTable.id, id));

    if (req.user!.role === "doctor") {
      const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
      if (doctors.length > 0) {
        await db.update(doctorsTable)
          .set({ totalConsultations: (doctors[0].totalConsultations ?? 0) + 1 })
          .where(eq(doctorsTable.id, doctors[0].id));
      }
    }

    res.json({ success: true, message: "Consultation marked as complete" });
  } catch (err) {
    req.log.error({ err }, "Complete consultation error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/prescription", requireAuth, async (req, res) => {
  try {
    if (req.user!.role !== "doctor") {
      res.status(403).json({ error: "Only doctors can send prescriptions" });
      return;
    }

    const id = parseInt(req.params.id);
    const { content, documentUrl, notes } = req.body;

    if (!content && !documentUrl) {
      res.status(400).json({ error: "content or documentUrl is required" });
      return;
    }

    const [presc] = await db.insert(prescriptionsTable).values({
      consultationId: id,
      content: content || "Document attached",
      documentUrl,
      notes,
    }).returning();

    res.status(201).json({
      id: presc.id,
      consultationId: presc.consultationId,
      content: presc.content,
      documentUrl: presc.documentUrl,
      notes: presc.notes,
      createdAt: presc.createdAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Send prescription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/medication", requireAuth, async (req, res) => {
  try {
    if (req.user!.role !== "doctor") {
      res.status(403).json({ error: "Only doctors can send medication orders" });
      return;
    }

    const id = parseInt(req.params.id);
    const { medications, instructions, pharmacyName } = req.body;

    if (!medications || !Array.isArray(medications)) {
      res.status(400).json({ error: "medications array is required" });
      return;
    }

    const [med] = await db.insert(medicationOrdersTable).values({
      consultationId: id,
      medications,
      instructions,
      pharmacyName,
      deliveryStatus: "pending",
    }).returning();

    res.status(201).json({
      id: med.id,
      consultationId: med.consultationId,
      medications: med.medications,
      instructions: med.instructions,
      pharmacyName: med.pharmacyName,
      deliveryStatus: med.deliveryStatus,
      deliveryNote: (med as any).deliveryNote,
      createdAt: med.createdAt?.toISOString(),
      updatedAt: med.updatedAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Send medication error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id/medication/:medId/status", requireAuth, async (req, res) => {
  try {
    const medId = parseInt(req.params.medId);
    const { deliveryStatus, deliveryNote } = req.body;

    const validStatuses = ["pending", "processing", "shipped", "delivered"];
    if (!validStatuses.includes(deliveryStatus)) {
      res.status(400).json({ error: "Invalid delivery status" });
      return;
    }

    const [updated] = await db.update(medicationOrdersTable)
      .set({ deliveryStatus: deliveryStatus as any, deliveryNote, updatedAt: new Date() } as any)
      .where(eq(medicationOrdersTable.id, medId))
      .returning();

    res.json({
      id: updated.id,
      consultationId: updated.consultationId,
      medications: updated.medications,
      instructions: updated.instructions,
      pharmacyName: updated.pharmacyName,
      deliveryStatus: updated.deliveryStatus,
      deliveryNote: (updated as any).deliveryNote,
      createdAt: updated.createdAt?.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Update medication status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
