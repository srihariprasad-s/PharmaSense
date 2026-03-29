import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import doctorsRouter from "./doctors";
import patientsRouter from "./patients";
import consultationsRouter from "./consultations";
import adminRouter from "./admin";
import webrtcRouter from "./webrtc";
import uploadRouter from "./upload";
import appointmentsRouter from "./appointments";
import rxAnalysisRouter from "./rx-analysis";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/doctors", doctorsRouter);
router.use("/patients", patientsRouter);
router.use("/consultations", consultationsRouter);
router.use("/admin", adminRouter);
router.use("/webrtc", webrtcRouter);
router.use("/upload", uploadRouter);
router.use("/appointments", appointmentsRouter);
router.use("/rx-analysis", rxAnalysisRouter);

export default router;
