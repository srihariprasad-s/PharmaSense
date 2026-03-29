import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageTransition, Card, Button, Badge } from "@/components/ui-elements";
import {
  Calendar, Clock, User, CheckCircle2, XCircle, Loader2,
  MessageSquare, ChevronDown, ChevronUp, Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(BASE_URL + url, { credentials: "include", ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "Declined", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  completed: { label: "Completed", color: "bg-primary/20 text-primary border-primary/30" },
};

export default function DoctorAppointments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments/doctor"],
    queryFn: () => fetchJson("/api/appointments/doctor"),
    refetchInterval: 10000,
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status, doctorNote }: { id: number; status: string; doctorNote: string }) =>
      fetchJson(`/api/appointments/${id}/respond`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, doctorNote }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments/doctor"] });
      toast({
        title: vars.status === "approved" ? "Appointment Approved" : "Appointment Declined",
        description: "The patient will be notified.",
      });
      setExpanded(e => ({ ...e, [vars.id]: false }));
    },
    onError: () => toast({ variant: "destructive", title: "Failed to respond" }),
  });

  const pending = (appointments as any[]).filter((a: any) => a.status === "pending");
  const rest = (appointments as any[]).filter((a: any) => a.status !== "pending");

  const AppointmentCard = ({ apt }: { apt: any }) => {
    const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG.pending;
    const isExpanded = expanded[apt.id];

    return (
      <Card key={apt.id} className={`p-5 ${apt.status === "pending" ? "border-yellow-500/30 shadow-sm" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <div className="font-bold text-foreground">{apt.patientName}</div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {apt.requestedDate}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {apt.requestedTime}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.color}`}>
              {cfg.label}
            </span>
            {apt.status === "pending" && (
              <button
                onClick={() => setExpanded(e => ({ ...e, [apt.id]: !e[apt.id] }))}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {apt.patientNote && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-2 text-sm">
              <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Patient's Note</span>
                <span className="text-foreground/80">{apt.patientNote}</span>
              </div>
            </div>
          </div>
        )}

        {apt.doctorNote && apt.status !== "pending" && (
          <div className={`mt-3 p-3 rounded-xl border ${apt.status === "rejected" ? "bg-red-500/10 border-red-500/20" : "bg-green-500/10 border-green-500/20"}`}>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Your Response</div>
            <p className="text-sm text-foreground/90">{apt.doctorNote}</p>
          </div>
        )}

        {/* Respond Panel */}
        {apt.status === "pending" && isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your Note to Patient <span className="normal-case font-normal">(optional)</span></label>
              <textarea
                value={notes[apt.id] || ""}
                onChange={e => setNotes(n => ({ ...n, [apt.id]: e.target.value }))}
                placeholder="Add a message for the patient (e.g. please bring your reports)…"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm resize-none focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 border-0 text-white gap-2"
                onClick={() => respondMutation.mutate({ id: apt.id, status: "approved", doctorNote: notes[apt.id] || "" })}
                isLoading={respondMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-2"
                onClick={() => respondMutation.mutate({ id: apt.id, status: "rejected", doctorNote: notes[apt.id] || "" })}
                isLoading={respondMutation.isPending}
              >
                <XCircle className="w-4 h-4" /> Decline
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 text-xs text-muted-foreground/50">
          Received {new Date(apt.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </Card>
    );
  };

  return (
    <PageTransition className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Appointments</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and manage patient appointment requests</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : appointments.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No appointment requests yet.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse inline-block" />
                Pending Review ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((apt: any) => <AppointmentCard key={apt.id} apt={apt} />)}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Past Appointments</h2>
              <div className="space-y-3">
                {rest.map((apt: any) => <AppointmentCard key={apt.id} apt={apt} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
