import { Router } from "express";
import { db, consultationsTable, webrtcSignalsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { randomBytes } from "crypto";

const router = Router();

router.post("/token", requireAuth, async (req, res) => {
  try {
    const { consultationId, role } = req.body;

    if (!consultationId || !role) {
      res.status(400).json({ error: "consultationId and role are required" });
      return;
    }

    const consultations = await db.select().from(consultationsTable)
      .where(eq(consultationsTable.id, consultationId))
      .limit(1);

    if (consultations.length === 0) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    const consultation = consultations[0];
    const roomId = consultation.roomId || `room_${consultationId}`;
    const token = randomBytes(16).toString("hex");

    res.json({ roomId, token, appId: "mediconnect_webrtc" });
  } catch (err) {
    req.log.error({ err }, "WebRTC token error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/signal/:consultationId", requireAuth, async (req, res) => {
  try {
    const consultationId = parseInt(req.params.consultationId);
    const { fromRole, toRole, signal } = req.body;

    await db.insert(webrtcSignalsTable).values({
      consultationId,
      fromRole,
      toRole,
      signal: JSON.stringify(signal),
      consumed: false,
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "WebRTC signal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/signal/:consultationId/:role", requireAuth, async (req, res) => {
  try {
    const consultationId = parseInt(req.params.consultationId);
    const role = req.params.role;

    const signals = await db.select()
      .from(webrtcSignalsTable)
      .where(
        and(
          eq(webrtcSignalsTable.consultationId, consultationId),
          eq(webrtcSignalsTable.toRole, role),
          eq(webrtcSignalsTable.consumed, false)
        )
      )
      .orderBy(asc(webrtcSignalsTable.id))
      .limit(20);

    if (signals.length > 0) {
      await db.update(webrtcSignalsTable)
        .set({ consumed: true })
        .where(
          and(
            eq(webrtcSignalsTable.consultationId, consultationId),
            eq(webrtcSignalsTable.toRole, role)
          )
        );
    }

    res.json(signals.map(s => ({
      id: s.id,
      fromRole: s.fromRole,
      signal: JSON.parse(s.signal),
    })));
  } catch (err) {
    req.log.error({ err }, "WebRTC poll signal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
