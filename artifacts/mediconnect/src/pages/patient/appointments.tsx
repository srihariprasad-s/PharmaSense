import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageTransition, Card, Button, Badge } from "@/components/ui-elements";
import {
  Calendar, Clock, User, CheckCircle2, XCircle, Loader2,
  MessageSquare, Stethoscope, Plus, ChevronDown, ChevronUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(BASE_URL + url, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "Declined", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
  completed: { label: "Completed", color: "bg-primary/20 text-primary border-primary/30", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function PatientAppointments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doctorId: "", requestedDate: "", requestedTime: "", patientNote: "" });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments/my"],
    queryFn: () => fetchJson("/api/appointments/my"),
    refetchInterval: 15000,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["/api/doctors/search"],
    queryFn: () => fetchJson("/api/doctors/search?limit=100"),
  });

  const bookMutation = useMutation({
    mutationFn: (data: typeof form) =>
      fetchJson("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/my"] });
      toast({ title: "Appointment Requested", description: "The doctor will review and respond soon." });
      setForm({ doctorId: "", requestedDate: "", requestedTime: "", patientNote: "" });
      setShowForm(false);
    },
    onError: () => toast({ variant: "destructive", title: "Failed to request appointment" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doctorId || !form.requestedDate || !form.requestedTime) {
      toast({ variant: "destructive", title: "Please fill all required fields" });
      return;
    }
    bookMutation.mutate(form);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <PageTransition className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">Schedule and track your doctor appointments</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "New Appointment"}
        </Button>
      </div>

      {/* Booking Form */}
      {showForm && (
        <Card className="p-6 border-primary/20 shadow-glow">
          <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" /> Schedule an Appointment
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Doctor *</label>
              <select
                value={form.doctorId}
                onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                required
              >
                <option value="">Select a doctor…</option>
                {(doctors as any[]).map((d: any) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name} — {d.specialty}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Date *</label>
                <input
                  type="date"
                  min={today}
                  value={form.requestedDate}
                  onChange={e => setForm(f => ({ ...f, requestedDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Preferred Time *</label>
                <input
                  type="time"
                  value={form.requestedTime}
                  onChange={e => setForm(f => ({ ...f, requestedTime: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Note to Doctor <span className="text-muted-foreground normal-case font-normal">(optional)</span></label>
              <textarea
                value={form.patientNote}
                onChange={e => setForm(f => ({ ...f, patientNote: e.target.value }))}
                placeholder="Describe your symptoms or reason for visit…"
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm resize-none focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <Button type="submit" className="w-full" isLoading={bookMutation.isPending}>
              <Calendar className="w-4 h-4 mr-2" /> Request Appointment
            </Button>
          </form>
        </Card>
      )}

      {/* Appointments List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : appointments.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No appointments yet.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Click "New Appointment" to schedule one.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(appointments as any[]).map((apt: any) => {
            const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.pending;
            return (
              <Card key={apt.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Stethoscope className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">Dr. {apt.doctorName}</div>
                      <div className="text-sm text-muted-foreground">{apt.doctorSpecialty}</div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {apt.requestedDate}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {apt.requestedTime}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                </div>

                {apt.patientNote && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-start gap-2 text-sm">
                      <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Your Note</span>
                        <span className="text-foreground/80">{apt.patientNote}</span>
                      </div>
                    </div>
                  </div>
                )}

                {apt.doctorNote && (
                  <div className={`mt-3 p-3 rounded-xl border ${apt.status === "rejected" ? "bg-red-500/10 border-red-500/20" : "bg-green-500/10 border-green-500/20"}`}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Doctor's Response</div>
                    <p className="text-sm text-foreground/90">{apt.doctorNote}</p>
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground/50">
                  Requested {new Date(apt.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
