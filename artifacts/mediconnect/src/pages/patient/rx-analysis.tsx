import { useState, useRef } from "react";
import { PageTransition, Button, Badge } from "@/components/ui-elements";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Upload, FlaskConical, Loader2, Pill, AlertTriangle, CheckCircle2,
  Salad, Zap, ShieldAlert, TrendingUp, StopCircle, Heart, ChevronRight,
  FileText, Clock, Stethoscope, Flame, Info, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = 1 | 2 | 3;

interface Medication {
  name: string;
  genericName?: string;
  dosage: string;
  prescribedDays: number;
  takenFor: string;
  diseaseOrDeficiency: string;
  mechanism?: string;
  sideEffects?: string[];
  interactions?: string;
}

interface ProgressMilestone {
  week: number;
  withMed: number;
  withoutMed: number;
  optimized: number;
  milestone?: string;
}

interface Analysis {
  medications: Medication[];
  primaryCondition: string;
  overallAssessment: string;
  forecasting: {
    recoveryWeeksWithMedication: number;
    recoveryWeeksWithoutMedication: number;
    recoveryWeeksOptimized: number;
    optimizationTips: string[];
    recoveryFactors?: string;
    progressMilestones: ProgressMilestone[];
  };
  foodSuggestions: { food: string; calories: string; benefit: string; servingSize?: string }[];
  foodsToAvoid: { food: string; reason: string }[];
  allergyConflicts?: string[];
  ifMedicationStopped: {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
    withdrawalRisk: string;
    mustTaper: boolean;
  };
  ifConditionWorsens: {
    warningSymptoms: string[];
    emergencySymptoms: string[];
    possibleComplications: string[];
    prognosis: string;
    urgency: string;
  };
}

const URGENCY_COLOR: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  emergency: "text-red-400",
};

const RISK_BG: Record<string, string> = {
  low: "bg-card border-green-500/40",
  medium: "bg-card border-yellow-500/40",
  high: "bg-card border-orange-500/40",
  emergency: "bg-card border-red-500/40",
};

const RISK_HEADER_BG: Record<string, string> = {
  low: "bg-green-500/10 border-green-500/20",
  medium: "bg-yellow-500/10 border-yellow-500/20",
  high: "bg-orange-500/10 border-orange-500/20",
  emergency: "bg-red-500/10 border-red-500/20",
};

export default function RxAnalysis() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [durationTaken, setDurationTaken] = useState("");
  const [allergies, setAllergies] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const handleFileChange = (f: File) => {
    setFile(f);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("prescription", file);
      formData.append("durationTaken", durationTaken);
      formData.append("allergies", allergies);

      const res = await fetch(`${BASE_URL}/api/rx-analysis`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Analysis failed");
      }

      const data: Analysis = await res.json();
      setAnalysis(data);
      setStep(3);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Analysis Failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const chartData = analysis?.forecasting.progressMilestones.map((m: any) => ({
    week: `Wk ${m.week}`,
    "Without Medication": m.withoutMed ?? m.without_med ?? null,
    "With Medication": m.withMed ?? m.with_med ?? null,
    "AI Optimised": m.optimized ?? m.optimised ?? m.aiOptimized ?? m.ai_optimized ?? null,
    milestone: m.milestone,
  })) ?? [];

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Prescription Analyser</h1>
            <p className="text-sm text-muted-foreground">Upload your prescription for AI-powered medication insights and recovery forecasting</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: "Upload" },
            { n: 2, label: "Your Info" },
            { n: 3, label: "Analysis" },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                step === n ? "bg-primary text-white" : step > n ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {step > n ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{n}</span>}
                {label}
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* ─── STEP 1: Upload ─── */}
        {step === 1 && (
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Upload Your Prescription</h2>
              <p className="text-sm text-muted-foreground">Supported formats: JPG, PNG, PDF. Max 10MB.</p>
            </div>

            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/jpg,image/webp,application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border hover:border-primary rounded-2xl p-12 flex flex-col items-center gap-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <Upload className="w-12 h-12" />
                <div className="text-center">
                  <div className="font-semibold text-base">Click to upload prescription</div>
                  <div className="text-xs mt-1">Drag and drop or click to browse</div>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                {preview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border max-h-80">
                    <img src={preview} alt="Prescription preview" className="w-full object-contain max-h-80 bg-secondary" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-secondary rounded-xl border border-border">
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <div className="font-semibold text-sm">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-primary hover:underline"
                  >
                    Change file
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!file}
              className="w-full h-12"
            >
              Continue <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ─── STEP 2: Patient Info ─── */}
        {step === 2 && (
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Your Medication Context</h2>
              <p className="text-sm text-muted-foreground">This helps our AI personalise the recovery forecast and food recommendations for you.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-foreground">
                  <Clock className="inline w-4 h-4 mr-1.5 text-primary" />
                  How long have you been taking this medication?
                </label>
                <input
                  type="text"
                  value={durationTaken}
                  onChange={(e) => setDurationTaken(e.target.value)}
                  placeholder="e.g. 3 days, 1 week, just started..."
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-foreground">
                  <AlertTriangle className="inline w-4 h-4 mr-1.5 text-orange-500" />
                  Known allergies (food, medicine, or other)
                </label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. penicillin, peanuts, sulfa drugs... or 'none'"
                  className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1.5">Food allergies are used to filter out unsuitable food recommendations.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12">
                Back
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={loading}
                className="flex-2 h-12 flex-1"
                isLoading={loading}
              >
                {loading ? "Analysing…" : <><FlaskConical className="w-4 h-4 mr-2" />Analyse Prescription</>}
              </Button>
            </div>

            {loading && (
              <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="text-sm font-medium">AI is reading your prescription…</div>
                <div className="text-xs">Extracting medications, generating recovery forecast & food plan</div>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 3: Results ─── */}
        {step === 3 && analysis && (
          <div className="space-y-6">

            {/* ── Overall Assessment ── */}
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 flex gap-4">
              <Stethoscope className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-foreground mb-1">{analysis.primaryCondition}</div>
                <div className="text-sm text-muted-foreground">{analysis.overallAssessment}</div>
              </div>
            </div>

            {/* ── Medications Table ── */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-base">Extracted Medications</h2>
                <Badge variant="outline" className="ml-auto">{analysis.medications.length} found</Badge>
              </div>
              <div className="divide-y divide-border">
                {analysis.medications.map((med, i) => (
                  <div key={i} className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-bold text-foreground">{med.name}</div>
                        {med.genericName && <div className="text-xs text-muted-foreground">{med.genericName}</div>}
                      </div>
                      <Badge variant="secondary" className="text-xs">{med.dosage}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-secondary rounded-xl text-xs space-y-1">
                        <div className="text-muted-foreground font-semibold uppercase tracking-wide">Prescribed For</div>
                        <div className="font-medium text-foreground">{med.diseaseOrDeficiency}</div>
                        <div className="text-muted-foreground">{med.takenFor}</div>
                      </div>
                      <div className="p-3 bg-secondary rounded-xl text-xs space-y-1">
                        <div className="text-muted-foreground font-semibold uppercase tracking-wide">Duration</div>
                        <div className="font-medium text-foreground text-lg">{med.prescribedDays} days</div>
                      </div>
                    </div>
                    {med.mechanism && (
                      <div className="flex gap-2 text-xs text-muted-foreground bg-secondary/50 p-3 rounded-xl">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                        {med.mechanism}
                      </div>
                    )}
                    {med.sideEffects && med.sideEffects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {med.sideEffects.map((s, j) => (
                          <span key={j} className="text-xs px-2 py-1 bg-orange-500/10 text-orange-300 rounded-full border border-orange-500/30">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recovery Forecast Chart ── */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-base">Recovery Timeline Forecast</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="text-center p-3 bg-secondary rounded-xl border-l-4 border-l-red-500 border border-border">
                    <div className="text-xl font-bold text-red-400">{analysis.forecasting.recoveryWeeksWithoutMedication}w</div>
                    <div className="text-xs text-muted-foreground mt-1">Without Medication</div>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-xl border-l-4 border-l-blue-500 border border-border">
                    <div className="text-xl font-bold text-blue-400">{analysis.forecasting.recoveryWeeksWithMedication}w</div>
                    <div className="text-xs text-muted-foreground mt-1">With Medication</div>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-xl border-l-4 border-l-green-500 border border-border">
                    <div className="text-xl font-bold text-green-400">{analysis.forecasting.recoveryWeeksOptimized}w</div>
                    <div className="text-xs text-muted-foreground mt-1">AI Optimised</div>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="rxColorMed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="rxColorNoMed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                      formatter={(v: any) => [`${v}%`, undefined]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="Without Medication" stroke="#ef4444" fill="url(#rxColorNoMed)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="With Medication" stroke="#3b82f6" fill="url(#rxColorMed)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="AI Optimised" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 3, fill: "#22c55e" }} strokeDasharray="6 3" connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>

                {analysis.forecasting.recoveryFactors && (
                  <div className="mt-4 text-xs text-muted-foreground bg-secondary p-3 rounded-xl">
                    <span className="font-semibold text-foreground">Key recovery factors: </span>{analysis.forecasting.recoveryFactors}
                  </div>
                )}

                {analysis.forecasting.optimizationTips?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Optimisation Tips</div>
                    {analysis.forecasting.optimizationTips.map((tip, i) => (
                      <div key={i} className="flex gap-2 text-xs text-foreground">
                        <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                        {tip}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Food Suggestions ── */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Salad className="w-5 h-5 text-green-500" />
                <h2 className="font-bold text-base">Recovery Diet Plan</h2>
                {allergies && <span className="text-xs text-muted-foreground ml-auto">Allergy-filtered for: {allergies}</span>}
              </div>
              {analysis.allergyConflicts && analysis.allergyConflicts.length > 0 && (
                <div className="mx-5 mt-4 flex gap-2 text-xs p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  <div><span className="font-semibold text-orange-300">Potential allergy conflicts: </span><span className="text-muted-foreground">{analysis.allergyConflicts.join(", ")}</span></div>
                </div>
              )}
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.foodSuggestions.map((f, i) => (
                  <div key={i} className="p-4 bg-secondary rounded-xl border border-border space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm text-foreground">{f.food}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Flame className="w-3 h-3 text-orange-400" />
                        {f.calories}
                      </div>
                    </div>
                    {f.servingSize && <div className="text-xs text-muted-foreground">Serving: {f.servingSize}</div>}
                    <div className="text-xs text-muted-foreground border-t border-border pt-2">{f.benefit}</div>
                  </div>
                ))}
              </div>

              {analysis.foodsToAvoid?.length > 0 && (
                <div className="mx-5 mb-5">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-1">Foods to Avoid</div>
                  <div className="space-y-2">
                    {analysis.foodsToAvoid.map((f, i) => (
                      <div key={i} className="flex gap-2 text-xs p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <div><span className="font-semibold text-red-300">{f.food}: </span><span className="text-muted-foreground">{f.reason}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── If Medication Stopped ── */}
            <div className={`border rounded-2xl overflow-hidden ${RISK_BG[analysis.ifMedicationStopped.withdrawalRisk] || RISK_BG.medium}`}>
              <div className={`px-5 py-4 border-b flex items-center gap-2 ${RISK_HEADER_BG[analysis.ifMedicationStopped.withdrawalRisk] || RISK_HEADER_BG.medium}`}>
                <StopCircle className="w-5 h-5 text-orange-400" />
                <h2 className="font-bold text-base text-foreground">If You Stop Taking This Medication</h2>
                <Badge variant="outline" className={`ml-auto text-xs capitalize ${URGENCY_COLOR[analysis.ifMedicationStopped.withdrawalRisk]}`}>
                  {analysis.ifMedicationStopped.withdrawalRisk} withdrawal risk
                </Badge>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-secondary rounded-xl border border-border space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Within 1-2 Days</div>
                  <div className="text-sm text-foreground">{analysis.ifMedicationStopped.shortTerm}</div>
                </div>
                <div className="p-3 bg-secondary rounded-xl border border-border space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Within 1-2 Weeks</div>
                  <div className="text-sm text-foreground">{analysis.ifMedicationStopped.mediumTerm}</div>
                </div>
                <div className="p-3 bg-secondary rounded-xl border border-border space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Long-Term</div>
                  <div className="text-sm text-foreground">{analysis.ifMedicationStopped.longTerm}</div>
                </div>
              </div>
              {analysis.ifMedicationStopped.mustTaper && (
                <div className="mx-5 mb-5 flex gap-2 text-xs p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <div className="font-medium text-yellow-300">Do not stop abruptly — consult your doctor for a tapering schedule.</div>
                </div>
              )}
            </div>

            {/* ── If Condition Worsens ── */}
            <div className={`border rounded-2xl overflow-hidden ${RISK_BG[analysis.ifConditionWorsens.urgency] || RISK_BG.medium}`}>
              <div className={`px-5 py-4 border-b flex items-center gap-2 ${RISK_HEADER_BG[analysis.ifConditionWorsens.urgency] || RISK_HEADER_BG.medium}`}>
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <h2 className="font-bold text-base text-foreground">If Your Condition Worsens</h2>
                <Badge variant="outline" className={`ml-auto text-xs capitalize ${URGENCY_COLOR[analysis.ifConditionWorsens.urgency]}`}>
                  {analysis.ifConditionWorsens.urgency} urgency
                </Badge>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Warning Symptoms — Seek Care</div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.ifConditionWorsens.warningSymptoms.map((s, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
                {analysis.ifConditionWorsens.emergencySymptoms?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Emergency Symptoms — Go to ER</div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.ifConditionWorsens.emergencySymptoms.map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 bg-red-500/15 border border-red-500/40 text-red-300 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.ifConditionWorsens.possibleComplications?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Possible Complications</div>
                    <div className="space-y-1.5">
                      {analysis.ifConditionWorsens.possibleComplications.map((c, i) => (
                        <div key={i} className="flex gap-2 text-xs text-foreground">
                          <Heart className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3 bg-secondary rounded-xl border border-border text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Prognosis if untreated: </span>{analysis.ifConditionWorsens.prognosis}
                </div>
              </div>
            </div>

            {/* ── Disclaimer ── */}
            <div className="flex gap-3 p-4 bg-secondary border border-border rounded-xl text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div>
                <span className="font-semibold text-foreground">Medical Disclaimer: </span>
                This AI analysis is for informational purposes only and is not a substitute for professional medical advice.
                Always follow your doctor's instructions and contact a healthcare professional before making any changes to your medication.
              </div>
            </div>

            {/* ── Analyse Another ── */}
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => { setStep(1); setFile(null); setPreview(null); setAnalysis(null); setDurationTaken(""); setAllergies(""); }}
            >
              <FlaskConical className="w-4 h-4 mr-2" /> Analyse Another Prescription
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
