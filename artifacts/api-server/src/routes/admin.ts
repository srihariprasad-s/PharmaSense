import { Router } from "express";
import { db, doctorsTable, usersTable, patientsTable, consultationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireRole } from "../middlewares/auth";

const router = Router();

router.get("/doctors/pending", requireRole("admin"), async (req, res) => {
  try {
    const pending = await db
      .select({
        id: doctorsTable.id,
        userId: doctorsTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        phone: doctorsTable.phone,
        registrationNumber: doctorsTable.registrationNumber,
        fatherName: doctorsTable.fatherName,
        year: doctorsTable.year,
        stateCouncil: doctorsTable.stateCouncil,
        nmcVerified: doctorsTable.nmcVerified,
        verificationStatus: doctorsTable.verificationStatus,
        createdAt: doctorsTable.createdAt,
      })
      .from(doctorsTable)
      .innerJoin(usersTable, eq(doctorsTable.userId, usersTable.id))
      .where(eq(doctorsTable.verificationStatus, "pending"))
      .orderBy(sql`${doctorsTable.createdAt} DESC`);

    res.json(pending);
  } catch (err) {
    req.log.error({ err }, "Get pending doctors error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/doctors/:id/approve", requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await db.update(doctorsTable)
      .set({ verificationStatus: "manually_approved", updatedAt: new Date() })
      .where(eq(doctorsTable.id, id));

    res.json({ success: true, message: "Doctor approved successfully" });
  } catch (err) {
    req.log.error({ err }, "Approve doctor error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/doctors/:id/reject", requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: "Reason is required" });
      return;
    }

    await db.update(doctorsTable)
      .set({
        verificationStatus: "rejected",
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(doctorsTable.id, id));

    res.json({ success: true, message: "Doctor rejected" });
  } catch (err) {
    req.log.error({ err }, "Reject doctor error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", requireRole("admin"), async (req, res) => {
  try {
    const [doctorCount] = await db.select({ count: sql<number>`count(*)` }).from(doctorsTable);
    const [pendingCount] = await db.select({ count: sql<number>`count(*)` }).from(doctorsTable)
      .where(eq(doctorsTable.verificationStatus, "pending"));
    const [patientCount] = await db.select({ count: sql<number>`count(*)` }).from(patientsTable);
    const [consultCount] = await db.select({ count: sql<number>`count(*)` }).from(consultationsTable);
    const [activeCount] = await db.select({ count: sql<number>`count(*)` }).from(consultationsTable)
      .where(sql`${consultationsTable.status} IN ('pending', 'accepted', 'paid', 'in_progress')`);

    res.json({
      totalDoctors: Number(doctorCount.count),
      pendingVerifications: Number(pendingCount.count),
      totalPatients: Number(patientCount.count),
      totalConsultations: Number(consultCount.count),
      activeConsultations: Number(activeCount.count),
    });
  } catch (err) {
    req.log.error({ err }, "Get admin stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
