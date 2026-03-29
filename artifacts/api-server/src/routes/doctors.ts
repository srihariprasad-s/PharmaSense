import { Router } from "express";
import { db, doctorsTable, usersTable, consultationsTable, patientsTable, prescriptionsTable, medicationOrdersTable } from "@workspace/db";
import { eq, ilike, and, or, sql, inArray, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.put("/profile", requireRole("doctor"), async (req, res) => {
  try {
    const { specialty, subSpecialty, languages, regions, experience, education, bio, consultationFee, symptoms } = req.body;

    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const [updated] = await db.update(doctorsTable)
      .set({
        specialty,
        subSpecialty,
        languages,
        regions,
        experience,
        education,
        bio,
        consultationFee,
        symptoms,
        updatedAt: new Date(),
      })
      .where(eq(doctorsTable.userId, req.user!.userId))
      .returning();

    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    
    res.json({
      id: updated.id,
      userId: updated.userId,
      name: user[0].name,
      email: user[0].email,
      phone: updated.phone,
      registrationNumber: updated.registrationNumber,
      stateCouncil: updated.stateCouncil,
      specialty: updated.specialty,
      subSpecialty: updated.subSpecialty,
      languages: updated.languages,
      regions: updated.regions,
      experience: updated.experience,
      education: updated.education,
      bio: updated.bio,
      consultationFee: updated.consultationFee,
      isOnline: updated.isOnline,
      verificationStatus: updated.verificationStatus,
      symptoms: updated.symptoms,
      rating: updated.rating,
      totalConsultations: updated.totalConsultations,
    });
  } catch (err) {
    req.log.error({ err }, "Update doctor profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/availability", requireRole("doctor"), async (req, res) => {
  try {
    const { isOnline } = req.body;

    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const approvedStatuses = ["nmc_verified", "manually_approved"];
    if (!approvedStatuses.includes(doctors[0].verificationStatus)) {
      res.status(403).json({ error: "Doctor not approved yet" });
      return;
    }

    await db.update(doctorsTable)
      .set({ isOnline, updatedAt: new Date() })
      .where(eq(doctorsTable.userId, req.user!.userId));

    res.json({ success: true, message: `Status updated to ${isOnline ? "online" : "offline"}` });
  } catch (err) {
    req.log.error({ err }, "Update availability error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { symptom, specialty, language, region, onlineOnly } = req.query as Record<string, string>;

    const approvedStatuses = ["nmc_verified", "manually_approved"];

    let query = db
      .select({
        id: doctorsTable.id,
        userId: doctorsTable.userId,
        name: usersTable.name,
        specialty: doctorsTable.specialty,
        subSpecialty: doctorsTable.subSpecialty,
        languages: doctorsTable.languages,
        regions: doctorsTable.regions,
        experience: doctorsTable.experience,
        consultationFee: doctorsTable.consultationFee,
        isOnline: doctorsTable.isOnline,
        rating: doctorsTable.rating,
        totalConsultations: doctorsTable.totalConsultations,
        symptoms: doctorsTable.symptoms,
      })
      .from(doctorsTable)
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(
        and(
          inArray(doctorsTable.verificationStatus, approvedStatuses),
          specialty ? ilike(doctorsTable.specialty, `%${specialty}%`) : undefined,
          onlineOnly === "true" ? eq(doctorsTable.isOnline, true) : undefined,
        )
      );

    let results = await query;

    if (symptom) {
      const symptomLower = symptom.toLowerCase();
      results = results.filter(d =>
        d.specialty?.toLowerCase().includes(symptomLower) ||
        d.subSpecialty?.toLowerCase().includes(symptomLower) ||
        d.symptoms?.some(s => s.toLowerCase().includes(symptomLower))
      );
    }

    const patientLanguage = (req as any).user?.language;
    const patientRegion = (req as any).user?.region;

    const enriched = results.map(d => {
      const isSameLanguage = language
        ? d.languages?.some(l => l.toLowerCase().includes(language.toLowerCase())) ?? false
        : false;
      const isSameRegion = region
        ? d.regions?.some(r => r.toLowerCase().includes(region.toLowerCase())) ?? false
        : false;

      return { ...d, isSameRegion, isSameLanguage };
    });

    enriched.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      if (a.isSameLanguage && !b.isSameLanguage) return -1;
      if (!a.isSameLanguage && b.isSameLanguage) return 1;
      if (a.isSameRegion && !b.isSameRegion) return -1;
      if (!a.isSameRegion && b.isSameRegion) return 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Search doctors error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/notifications", requireRole("doctor"), async (req, res) => {
  try {
    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const consultations = await db
      .select({
        id: consultationsTable.id,
        patientId: consultationsTable.patientId,
        doctorId: consultationsTable.doctorId,
        symptoms: consultationsTable.symptoms,
        notes: consultationsTable.notes,
        status: consultationsTable.status,
        rejectionReason: consultationsTable.rejectionReason,
        createdAt: consultationsTable.createdAt,
        patientName: usersTable.name,
        patientPhone: patientsTable.phone,
        patientLanguage: patientsTable.language,
        patientRegion: patientsTable.region,
        patientMedicalHistory: patientsTable.medicalHistory,
        patientAllergies: patientsTable.allergies,
      })
      .from(consultationsTable)
      .innerJoin(patientsTable, eq(consultationsTable.patientId, patientsTable.id))
      .innerJoin(usersTable, eq(patientsTable.userId, usersTable.id))
      .where(eq(consultationsTable.doctorId, doctors[0].id))
      .orderBy(sql`${consultationsTable.createdAt} DESC`);

    const enriched = await Promise.all(consultations.map(async c => {
      const prevCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(consultationsTable)
        .where(and(
          eq(consultationsTable.patientId, c.patientId),
          sql`${consultationsTable.id} != ${c.id}`,
          sql`${consultationsTable.status} IN ('completed', 'in_progress')`
        ));
      return { ...c, previousConsultations: Number(prevCount[0].count) };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Doctor notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── MUST be before /:id ─────────────────────────────────────────────────────
router.get("/consultations", requireRole("doctor"), async (req, res) => {
  try {
    const doctors = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.userId)).limit(1);
    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const consultations = await db
      .select({
        id: consultationsTable.id,
        patientId: consultationsTable.patientId,
        patientName: usersTable.name,
        symptoms: consultationsTable.symptoms,
        notes: consultationsTable.notes,
        status: consultationsTable.status,
        paymentStatus: consultationsTable.paymentStatus,
        createdAt: consultationsTable.createdAt,
        completedAt: consultationsTable.completedAt,
      })
      .from(consultationsTable)
      .innerJoin(patientsTable, eq(consultationsTable.patientId, patientsTable.id))
      .innerJoin(usersTable, eq(patientsTable.userId, usersTable.id))
      .where(eq(consultationsTable.doctorId, doctors[0].id))
      .orderBy(desc(consultationsTable.createdAt));

    const enriched = await Promise.all(consultations.map(async (c) => {
      const prescs = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.consultationId, c.id));
      const meds = await db.select().from(medicationOrdersTable).where(eq(medicationOrdersTable.consultationId, c.id));

      const [patient] = await db
        .select({
          bloodGroup: patientsTable.bloodGroup,
          allergies: patientsTable.allergies,
          medicalHistory: patientsTable.medicalHistory,
          phone: patientsTable.phone,
          language: patientsTable.language,
          region: patientsTable.region,
        })
        .from(patientsTable)
        .where(eq(patientsTable.id, c.patientId));

      return {
        ...c,
        createdAt: c.createdAt?.toISOString(),
        completedAt: c.completedAt?.toISOString(),
        patientDetails: patient,
        prescriptions: prescs.map(p => ({
          id: p.id,
          content: p.content,
          documentUrl: p.documentUrl,
          notes: p.notes,
          createdAt: p.createdAt?.toISOString(),
        })),
        medications: meds.map(m => ({
          id: m.id,
          medications: m.medications,
          instructions: m.instructions,
          pharmacyName: m.pharmacyName,
          deliveryStatus: m.deliveryStatus,
          deliveryNote: (m as any).deliveryNote,
          createdAt: m.createdAt?.toISOString(),
          updatedAt: m.updatedAt?.toISOString(),
        })),
      };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Get doctor consultations error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const doctors = await db
      .select({
        id: doctorsTable.id,
        userId: doctorsTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        phone: doctorsTable.phone,
        registrationNumber: doctorsTable.registrationNumber,
        stateCouncil: doctorsTable.stateCouncil,
        specialty: doctorsTable.specialty,
        subSpecialty: doctorsTable.subSpecialty,
        languages: doctorsTable.languages,
        regions: doctorsTable.regions,
        experience: doctorsTable.experience,
        education: doctorsTable.education,
        bio: doctorsTable.bio,
        consultationFee: doctorsTable.consultationFee,
        isOnline: doctorsTable.isOnline,
        verificationStatus: doctorsTable.verificationStatus,
        symptoms: doctorsTable.symptoms,
        rating: doctorsTable.rating,
        totalConsultations: doctorsTable.totalConsultations,
      })
      .from(doctorsTable)
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(eq(doctorsTable.id, id))
      .limit(1);

    if (doctors.length === 0) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    res.json(doctors[0]);
  } catch (err) {
    req.log.error({ err }, "Get doctor error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
