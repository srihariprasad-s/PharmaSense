import { Router } from "express";
import { db, usersTable, doctorsTable, patientsTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth";
import { verifyWithNMC, lookupNMC } from "../lib/nmc";

const router = Router();

// Real-time NMC lookup during registration (no auth required)
router.get("/nmc-lookup", async (req, res) => {
  const { regNo } = req.query;
  if (!regNo || typeof regNo !== "string") {
    res.status(400).json({ error: "regNo query param required" });
    return;
  }
  try {
    const { record, unreachable } = await lookupNMC(regNo.trim());
    if (unreachable) {
      res.status(503).json({ error: "NMC server unreachable", unreachable: true });
      return;
    }
    if (!record) {
      res.status(404).json({ found: false });
      return;
    }
    res.json({ found: true, ...record });
  } catch (err) {
    req.log.error({ err }, "NMC lookup error");
    res.status(503).json({ error: "NMC lookup failed", unreachable: true });
  }
});

router.post("/register/patient", async (req, res) => {
  try {
    const { name, email, password, phone, dateOfBirth, gender, language, region } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad request", message: "Name, email, and password are required" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email already in use" });
      return;
    }

    const passwordHash = hashPassword(password);
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Wrap in a transaction so a partial failure doesn't leave orphan rows
    const { user } = await db.transaction(async (tx) => {
      const [user] = await tx.insert(usersTable).values({
        name,
        email,
        passwordHash,
        role: "patient",
      }).returning();

      await tx.insert(patientsTable).values({
        userId: user.id,
        phone: phone || null,
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
        language: language || null,
        region: region || null,
      });

      await tx.insert(sessionsTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      return { user };
    });

    res.cookie("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
    });

    res.status(201).json({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      token,
    });
  } catch (err: any) {
    req.log.error({ err }, "Patient register error");
    // Surface DB constraint errors more clearly
    if (err?.code === "23505") {
      res.status(409).json({ error: "Conflict", message: "An account with this email already exists" });
    } else {
      res.status(500).json({ error: "Internal server error", message: "Registration failed. Please try again." });
    }
  }
});

router.post("/register/doctor", async (req, res) => {
  try {
    const { name, email, password, phone, registrationNumber, fatherName, year, stateCouncil } = req.body;

    if (!name || !email || !password || !registrationNumber || !fatherName || !year || !stateCouncil) {
      res.status(400).json({ error: "Bad request", message: "All fields are required" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Conflict", message: "Email already in use" });
      return;
    }

    // Run NMC verification BEFORE DB transaction (it's slow — no point holding a TX open)
    const nmcResult = await verifyWithNMC(registrationNumber, year, stateCouncil, fatherName);

    const passwordHash = hashPassword(password);
    const verificationStatus = nmcResult.verified ? "nmc_verified" : "pending";

    // Atomic insert — if doctor row fails, the user row is rolled back too
    const { user } = await db.transaction(async (tx) => {
      const [user] = await tx.insert(usersTable).values({
        name,
        email,
        passwordHash,
        role: "doctor",
      }).returning();

      await tx.insert(doctorsTable).values({
        userId: user.id,
        registrationNumber,
        fatherName,
        year,
        stateCouncil,
        phone: phone || null,
        nmcVerified: nmcResult.verified,
        verificationStatus: verificationStatus as any,
      });

      return { user };
    });

    res.status(201).json({
      userId: user.id,
      nmcVerified: nmcResult.verified,
      verificationStatus,
      nmcUnreachable: nmcResult.unreachable,
      message: nmcResult.verified
        ? "Your registration has been verified with NMC. You can now log in and complete your profile."
        : nmcResult.unreachable
          ? "The NMC server was temporarily unreachable during your registration. Your application is pending — you can retry NMC verification from your dashboard once the server is back online."
          : "We could not automatically verify your registration with NMC. Your application has been submitted for manual review. You will be notified via email once approved.",
    });
  } catch (err: any) {
    req.log.error({ err }, "Doctor register error");
    if (err?.code === "23505") {
      res.status(409).json({ error: "Conflict", message: "An account with this email or registration number already exists" });
    } else {
      res.status(500).json({ error: "Internal server error", message: "Registration failed. Please try again." });
    }
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Bad request", message: "Email and password are required" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (users.length === 0) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const user = users[0];
    if (!verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(sessionsTable).values({
      userId: user.id,
      token,
      expiresAt,
    });

    res.cookie("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
    });

    res.json({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      token,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Re-verify NMC for a pending doctor (authenticated)
router.post("/nmc-reverify", async (req, res) => {
  try {
    const token = req.cookies?.["session_token"] || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
    if (sessions.length === 0 || sessions[0].expiresAt < new Date()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
    if (users.length === 0 || users[0].role !== "doctor") {
      res.status(403).json({ error: "Only doctors can re-verify" });
      return;
    }

    const docs = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, users[0].id)).limit(1);
    if (docs.length === 0) {
      res.status(404).json({ error: "Doctor profile not found" });
      return;
    }

    const doctor = docs[0];
    if (doctor.verificationStatus === "nmc_verified" || doctor.verificationStatus === "manually_approved") {
      res.json({ alreadyVerified: true, verificationStatus: doctor.verificationStatus });
      return;
    }

    const nmcResult = await verifyWithNMC(
      doctor.registrationNumber,
      doctor.year,
      doctor.stateCouncil,
      doctor.fatherName,
    );

    if (nmcResult.unreachable) {
      res.status(503).json({
        error: "NMC server still unreachable",
        unreachable: true,
        message: "The NMC server is still temporarily unavailable. Please try again in a few minutes.",
      });
      return;
    }

    if (nmcResult.verified) {
      await db
        .update(doctorsTable)
        .set({ verificationStatus: "nmc_verified", nmcVerified: true })
        .where(eq(doctorsTable.id, doctor.id));
    }

    res.json({
      verified: nmcResult.verified,
      unreachable: false,
      verificationStatus: nmcResult.verified ? "nmc_verified" : "pending",
      message: nmcResult.verified
        ? "Your NMC registration has been successfully verified! You can now access the platform."
        : "Your registration number could not be verified with NMC. Your application will be reviewed manually by an admin.",
    });
  } catch (err) {
    req.log.error({ err }, "NMC re-verify error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const token = req.cookies?.["session_token"] || req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    }
    res.clearCookie("session_token");
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.["session_token"] || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sessions = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, token))
      .limit(1);

    if (sessions.length === 0 || sessions[0].expiresAt < new Date()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
    if (users.length === 0) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = users[0];
    let verificationStatus: string | undefined;
    let isOnline: boolean | undefined;
    let profileComplete = false;
    let doctorId: number | undefined;
    let patientId: number | undefined;

    if (user.role === "doctor") {
      const docs = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, user.id)).limit(1);
      if (docs.length > 0) {
        verificationStatus = docs[0].verificationStatus;
        isOnline = docs[0].isOnline;
        profileComplete = !!(docs[0].specialty && docs[0].experience);
        doctorId = docs[0].id;
      }
    } else if (user.role === "patient") {
      const patients = await db.select().from(patientsTable).where(eq(patientsTable.userId, user.id)).limit(1);
      if (patients.length > 0) {
        patientId = patients[0].id;
        profileComplete = true;
      }
    }

    res.json({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      verificationStatus,
      isOnline,
      profileComplete,
      doctorId,
      patientId,
    });
  } catch (err) {
    req.log.error({ err }, "Me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
