import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { PageTransition, Card, Button, Badge, Input } from "@/components/ui-elements";
import {
  Users, FileText, Pill, Calendar, ChevronDown, ChevronUp,
  Send, ExternalLink, Paperclip, Package, AlertCircle, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type Prescription = { id: number; content: string; documentUrl?: string; notes?: string; createdAt: string };
type Medication = {
  id: number; medications: string[]; instructions?: string; pharmacyName?: string;
  deliveryStatus: string; deliveryNote?: string; createdAt: string; updatedAt: string;
};
type PatientDetails = {
  bloodGroup?: string; allergies?: string[]; medicalHistory?: string;
  phone?: string; language?: string; region?: string;
};
type Consultation = {
  id: number; patientId: number; patientName: string; symptoms: string; notes?: string;
  status: string; paymentStatus: string; createdAt: string; completedAt?: string;
  patientDetails?: PatientDetails; prescriptions: Prescription[]; medications: Medication[];
};

const STATUS_MAP: Record<string, "default" | "success" | "warning" | "outline"> = {
  completed: "success", accepted: "warning", pending: "outline", rejected: "outline", paid: "warning",
};

export default function DoctorPatients() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Per-consultation form state
  const [rxForm, setRxForm] = useState<Record<number, { content: string; documentUrl: string; notes: string; uploadedFileName: string | null }>>({});
  const [medForm, setMedForm] = useState<Record<number, { medications: string; instructions: string; pharmacyName: string }>>({});
  const [delForm, setDelForm] = useState<Record<string, { status: string; note: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const fetchConsultations = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/doctors/consultations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setConsultations(data);
    } catch {
      setError("Could not load patient records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConsultations(); }, []);

  const handleFileUpload = async (consultationId: number, file: File) => {
    setUploading(consultationId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_URL}/api/upload`, { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setRxForm(prev => ({
        ...prev,
        [consultationId]: { ...(prev[consultationId] || { content: "", documentUrl: "", notes: "", uploadedFileName: null }), documentUrl: data.url, uploadedFileName: file.name },
      }));
      toast({ title: "File uploaded", description: file.name });
    } catch {
      toast({ variant: "destructive", title: "Upload failed" });
    } finally {
      setUploading(null);
    }
  };

  const sendPrescription = async (consultationId: number) => {
    const form = rxForm[consultationId] || { content: "", documentUrl: "", notes: "", uploadedFileName: null };
    if (!form.content && !form.documentUrl) return;
    setSubmitting(`rx-${consultationId}`);
    try {
      const res = await fetch(`${BASE_URL}/api/consultations/${consultationId}/prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: form.content || "Document attached", documentUrl: form.documentUrl || undefined, notes: form.notes || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      setRxForm(prev => ({ ...prev, [consultationId]: { content: "", documentUrl: "", notes: "", uploadedFileName: null } }));
      if (fileInputRefs.current[consultationId]) fileInputRefs.current[consultationId]!.value = "";
      toast({ title: "Prescription sent" });
      fetchConsultations();
    } catch {
      toast({ variant: "destructive", title: "Failed to send prescription" });
    } finally {
      setSubmitting(null);
    }
  };

  const sendMedication = async (consultationId: number) => {
    const form = medForm[consultationId] || { medications: "", instructions: "", pharmacyName: "" };
    if (!form.medications) return;
    setSubmitting(`med-${consultationId}`);
    try {
      const meds = form.medications.split(",").map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${BASE_URL}/api/consultations/${consultationId}/medication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ medications: meds, instructions: form.instructions || undefined, pharmacyName: form.pharmacyName || "PharmaSense Rx" }),
      });
      if (!res.ok) throw new Error("Failed");
      setMedForm(prev => ({ ...prev, [consultationId]: { medications: "", instructions: "", pharmacyName: "" } }));
      toast({ title: "Medication order sent" });
      fetchConsultations();
    } catch {
      toast({ variant: "destructive", title: "Failed to send medication order" });
    } finally {
      setSubmitting(null);
    }
  };

  const updateDelivery = async (consultationId: number, medId: number) => {
    const key = `${consultationId}-${medId}`;
    const form = delForm[key] || { status: "processing", note: "" };
    setSubmitting(`del-${key}`);
    try {
      const res = await fetch(`${BASE_URL}/api/consultations/${consultationId}/medication/${medId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deliveryStatus: form.status, deliveryNote: form.note || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Delivery status updated" });
      fetchConsultations();
    } catch {
      toast({ variant: "destructive", title: "Failed to update delivery" });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageTransition className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" /> Patient Records
          </h1>
          <p className="text-muted-foreground mt-1">Manage prescriptions, medications, and delivery status for all your patients.</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/doctor/dashboard")}>← Back to Dashboard</Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-4 rounded-xl">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {consultations.length === 0 && !error && (
        <Card className="p-12 text-center border-dashed">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-bold">No consultations yet</h3>
          <p className="text-muted-foreground">Patient records will appear here after your first accepted consultation.</p>
        </Card>
      )}

      <div className="space-y-4">
        {consultations.map(c => {
          const isOpen = expanded === c.id;
          const rxF = rxForm[c.id] || { content: "", documentUrl: "", notes: "", uploadedFileName: null };
          const medF = medForm[c.id] || { medications: "", instructions: "", pharmacyName: "" };

          return (
            <Card key={c.id} className="overflow-hidden">
              {/* Header */}
              <button
                className="w-full p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : c.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                    {c.patientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-lg">{c.patientName}</div>
                    <div className="text-sm text-muted-foreground">{format(new Date(c.createdAt), "dd MMM yyyy")}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_MAP[c.status as keyof typeof STATUS_MAP] || "outline"} className="capitalize">{c.status}</Badge>
                  <span className="text-xs text-muted-foreground">{c.prescriptions.length} Rx • {c.medications.length} Meds</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border p-5 space-y-6 bg-secondary/10">
                  {/* Patient Info */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-secondary rounded-xl border border-border">
                      <h4 className="font-bold text-sm mb-3">Symptoms & Notes</h4>
                      <p className="text-sm bg-secondary p-3 rounded-lg mb-2">{c.symptoms}</p>
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </div>
                    {c.patientDetails && (
                      <div className="p-4 bg-secondary rounded-xl border border-border">
                        <h4 className="font-bold text-sm mb-3">Patient Details</h4>
                        <div className="space-y-1 text-sm">
                          {c.patientDetails.bloodGroup && <div><span className="text-muted-foreground">Blood Group:</span> {c.patientDetails.bloodGroup}</div>}
                          {c.patientDetails.phone && <div><span className="text-muted-foreground">Phone:</span> {c.patientDetails.phone}</div>}
                          {c.patientDetails.allergies && c.patientDetails.allergies.length > 0 && (
                            <div><span className="text-muted-foreground">Allergies:</span> {c.patientDetails.allergies.join(", ")}</div>
                          )}
                          {c.patientDetails.medicalHistory && <div><span className="text-muted-foreground">History:</span> {c.patientDetails.medicalHistory}</div>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Existing Prescriptions */}
                  {c.prescriptions.length > 0 && (
                    <div>
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Prescriptions Sent</h4>
                      <div className="space-y-2">
                        {c.prescriptions.map(p => (
                          <div key={p.id} className="p-3 bg-secondary rounded-xl border border-border text-sm">
                            <p className="font-medium">{p.content}</p>
                            {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                            {p.documentUrl && (
                              <a href={p.documentUrl} download rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-primary text-xs hover:underline">
                                <ExternalLink className="w-3 h-3" /> Download Document
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Send New Prescription */}
                  <div className="p-4 bg-secondary rounded-xl border border-border">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Send Prescription / Document</h4>
                    <div className="space-y-2">
                      <textarea
                        value={rxF.content}
                        onChange={e => setRxForm(prev => ({ ...prev, [c.id]: { ...rxF, content: e.target.value } }))}
                        placeholder="Prescription text (optional if providing document link)"
                        className="w-full text-sm p-3 border border-border rounded-xl resize-none focus:ring-2 focus:ring-primary outline-none bg-secondary text-foreground"
                        rows={2}
                      />
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                            ref={el => { fileInputRefs.current[c.id] = el; }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(c.id, f); }}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[c.id]?.click()}
                            disabled={uploading === c.id}
                            className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-xl hover:border-primary/50 transition-colors text-muted-foreground w-full"
                          >
                            {uploading === c.id
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                              : rxF.uploadedFileName
                                ? <><Paperclip className="w-3.5 h-3.5 text-primary shrink-0" /><span className="truncate text-foreground">{rxF.uploadedFileName}</span></>
                                : <><Paperclip className="w-3.5 h-3.5 shrink-0" /> Attach file (PDF, image…)</>
                            }
                          </button>
                        </div>
                        <input
                          value={rxF.notes}
                          onChange={e => setRxForm(prev => ({ ...prev, [c.id]: { ...rxF, notes: e.target.value } }))}
                          placeholder="Notes"
                          className="w-36 px-3 py-2 text-sm border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none bg-secondary text-foreground"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => sendPrescription(c.id)}
                        disabled={!rxF.content && !rxF.documentUrl}
                        isLoading={submitting === `rx-${c.id}`}
                        className="w-full"
                      >
                        <Send className="w-3.5 h-3.5 mr-2" /> Send Prescription
                      </Button>
                    </div>
                  </div>

                  {/* Medications */}
                  {c.medications.length > 0 && (
                    <div>
                      <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Pill className="w-4 h-4 text-accent" /> Medication Orders</h4>
                      <div className="space-y-3">
                        {c.medications.map(m => {
                          const key = `${c.id}-${m.id}`;
                          const df = delForm[key] || { status: m.deliveryStatus, note: m.deliveryNote || "" };
                          return (
                            <div key={m.id} className="p-4 bg-secondary rounded-xl border border-border text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-medium">{m.medications.join(", ")}</div>
                                  {m.pharmacyName && <div className="text-xs text-muted-foreground">{m.pharmacyName}</div>}
                                  {m.instructions && <div className="text-xs text-muted-foreground mt-1">{m.instructions}</div>}
                                </div>
                                <Badge variant={m.deliveryStatus === "delivered" ? "success" : "warning"} className="capitalize text-xs ml-2 shrink-0">{m.deliveryStatus}</Badge>
                              </div>
                              {m.deliveryNote && (
                                <div className="text-xs text-muted-foreground bg-secondary p-2 rounded-lg mb-3">Note: {m.deliveryNote}</div>
                              )}
                              {m.deliveryStatus !== "delivered" && (
                                <div className="pt-3 border-t border-border space-y-2">
                                  <div className="flex gap-2">
                                    <select
                                      className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5"
                                      value={df.status}
                                      onChange={e => setDelForm(prev => ({ ...prev, [key]: { ...df, status: e.target.value } }))}
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="processing">Processing</option>
                                      <option value="shipped">Shipped</option>
                                      <option value="delivered">Delivered</option>
                                    </select>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="shrink-0"
                                      onClick={() => updateDelivery(c.id, m.id)}
                                      isLoading={submitting === `del-${key}`}
                                    >
                                      <Package className="w-3.5 h-3.5 mr-1.5" /> Update
                                    </Button>
                                  </div>
                                  <input
                                    value={df.note}
                                    onChange={e => setDelForm(prev => ({ ...prev, [key]: { ...df, note: e.target.value } }))}
                                    placeholder="Delivery note (e.g. Out for delivery in Sector 4…)"
                                    className="w-full px-3 py-2 text-xs border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Order New Medication */}
                  <div className="p-4 bg-secondary rounded-xl border border-border">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Pill className="w-4 h-4 text-accent" /> Order Medication</h4>
                    <div className="space-y-2">
                      <Input
                        value={medF.medications}
                        onChange={e => setMedForm(prev => ({ ...prev, [c.id]: { ...medF, medications: e.target.value } }))}
                        placeholder="Medications (comma separated)"
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={medF.instructions}
                          onChange={e => setMedForm(prev => ({ ...prev, [c.id]: { ...medF, instructions: e.target.value } }))}
                          placeholder="Instructions (optional)"
                          className="flex-1 h-9 text-sm"
                        />
                        <Input
                          value={medF.pharmacyName}
                          onChange={e => setMedForm(prev => ({ ...prev, [c.id]: { ...medF, pharmacyName: e.target.value } }))}
                          placeholder="Pharmacy name"
                          className="w-40 h-9 text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-accent hover:bg-accent/90 border-0 text-white"
                        onClick={() => sendMedication(c.id)}
                        disabled={!medF.medications}
                        isLoading={submitting === `med-${c.id}`}
                      >
                        <Send className="w-3.5 h-3.5 mr-2" /> Order Medication
                      </Button>
                    </div>
                  </div>

                  {/* Jump to Consultation Room */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/doctor/consultation/${c.id}`)}
                    >
                      Open Consultation Room →
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </PageTransition>
  );
}
