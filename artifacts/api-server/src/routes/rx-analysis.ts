import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth";
import { openai } from "@workspace/integrations-openai-ai-server";
// Import from the internal lib path to avoid pdf-parse's startup test-file read bug
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const SYSTEM_PROMPT = `You are a clinical pharmacist AI assistant for PharmaSense, an Indian telemedicine platform.
You analyze prescription documents and provide detailed medication analysis and AI-powered recovery forecasting.
You MUST respond ONLY with valid JSON, no prose, no markdown fences, no extra text.
Base your analysis STRICTLY on the actual document content provided. Do NOT invent medications or conditions.`;

const buildUserPrompt = (
  contextBlock: string,
  durationTaken: string,
  allergies: string
) => `Analyze the following prescription document content.
Patient context:
- Duration they have been taking the medication: ${durationTaken || "not specified"}
- Known allergies: ${allergies || "none reported"}

${contextBlock}

Extract all medications EXACTLY as written in the document and generate a comprehensive analysis.
Respond with this exact JSON structure:

{
  "medications": [
    {
      "name": "medicine name exactly as on prescription",
      "genericName": "generic/chemical name",
      "dosage": "e.g. 500mg twice daily",
      "prescribedDays": 10,
      "takenFor": "what disease or deficiency this treats",
      "diseaseOrDeficiency": "full condition name",
      "mechanism": "how this drug works in 1-2 sentences",
      "sideEffects": ["common side effect 1", "common side effect 2"],
      "interactions": "notable drug interactions or 'none known'"
    }
  ],
  "primaryCondition": "the main condition being treated as identified from the prescription",
  "overallAssessment": "1-2 sentence clinical summary based on the actual prescription content",
  "forecasting": {
    "recoveryWeeksWithMedication": 4,
    "recoveryWeeksWithoutMedication": 10,
    "recoveryWeeksOptimized": 3,
    "optimizationTips": ["tip 1 for faster recovery", "tip 2"],
    "recoveryFactors": "what factors most influence recovery for this condition",
    "progressMilestones": [
      { "week": 1, "withMed": 20, "withoutMed": 5, "optimized": 30, "milestone": "Initial improvement expected" },
      { "week": 2, "withMed": 40, "withoutMed": 10, "optimized": 55, "milestone": "Significant symptom relief" },
      { "week": 4, "withMed": 75, "withoutMed": 20, "optimized": 90, "milestone": "Near full recovery" },
      { "week": 6, "withMed": 90, "withoutMed": 35, "optimized": 98, "milestone": "Full recovery milestone" },
      { "week": 10, "withMed": 100, "withoutMed": 65, "optimized": 100, "milestone": "Complete recovery" }
    ]
  },
  "foodSuggestions": [
    {
      "food": "food name",
      "calories": "approx calories per serving",
      "benefit": "how it specifically helps recovery from this condition",
      "servingSize": "e.g. 1 cup or 100g"
    }
  ],
  "foodsToAvoid": [
    {
      "food": "food to avoid",
      "reason": "why to avoid during treatment"
    }
  ],
  "allergyConflicts": ["any foods in suggestions that may conflict with patient allergies"],
  "ifMedicationStopped": {
    "shortTerm": "what happens in 1-2 days if stopped abruptly",
    "mediumTerm": "what happens in 1-2 weeks",
    "longTerm": "long-term consequences of stopping",
    "withdrawalRisk": "low|medium|high",
    "mustTaper": true
  },
  "ifConditionWorsens": {
    "warningSymptoms": ["symptom 1 to watch for", "symptom 2"],
    "emergencySymptoms": ["emergency symptom 1"],
    "possibleComplications": ["complication 1", "complication 2"],
    "prognosis": "what can happen if untreated and condition progresses",
    "urgency": "low|medium|high|emergency"
  }
}`;

router.post("/", requireAuth, upload.single("prescription"), async (req, res) => {
  try {
    const { durationTaken, allergies } = req.body as { durationTaken: string; allergies: string };
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "Prescription file is required" });
      return;
    }

    const isImage = file.mimetype.startsWith("image/");
    const isPdf = file.mimetype === "application/pdf";

    if (!isImage && !isPdf) {
      res.status(400).json({ error: "Only image or PDF files are supported" });
      return;
    }

    let messageContent: any[];

    if (isImage) {
      // ── Image: send directly to the vision model ──
      const base64Data = file.buffer.toString("base64");
      const dataUri = `data:${file.mimetype};base64,${base64Data}`;

      messageContent = [
        {
          type: "text",
          text: buildUserPrompt(
            "The prescription image is attached below. Read all text visible in the image carefully.",
            durationTaken,
            allergies
          ),
        },
        { type: "image_url", image_url: { url: dataUri } },
      ];
    } else {
      // ── PDF: extract text first, then send text to AI ──
      let pdfText = "";
      try {
        const parsed = await pdfParse(file.buffer);
        pdfText = parsed.text?.trim() ?? "";
      } catch (parseErr) {
        req.log.warn({ parseErr }, "pdf-parse failed — will send raw description");
      }

      if (!pdfText || pdfText.length < 20) {
        // Scanned / image-only PDF — can't extract text
        res.status(422).json({
          error:
            "This PDF appears to be a scanned image without readable text. " +
            "Please upload a photo (JPG/PNG) of the prescription instead for accurate analysis.",
        });
        return;
      }

      messageContent = [
        {
          type: "text",
          text: buildUserPrompt(
            `Here is the full extracted text from the prescription PDF:\n\n---\n${pdfText}\n---`,
            durationTaken,
            allergies
          ),
        },
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: messageContent },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? "{}";

    let analysis: Record<string, unknown>;
    try {
      const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      analysis = JSON.parse(cleaned);
    } catch {
      req.log.error({ rawText }, "Failed to parse OpenAI response as JSON");
      res.status(500).json({ error: "AI analysis failed to parse. Please try again." });
      return;
    }

    res.json(analysis);
  } catch (err) {
    req.log.error({ err }, "Rx analysis error");
    res.status(500).json({ error: "Analysis failed. Please try again." });
  }
});

export default router;
