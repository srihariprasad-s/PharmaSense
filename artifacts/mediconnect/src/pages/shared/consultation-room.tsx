import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  useGetConsultation,
  useCreatePayment,
  useConfirmPayment,
  useCompleteConsultation,
  useSendPrescription,
  useSendMedication,
  useUpdateMedicationStatus,
} from "@workspace/api-client-react";
import { PageTransition, Card, Button, Badge, Input } from "@/components/ui-elements";
import {
  Video, Mic, MicOff, VideoOff, PhoneOff, CheckCircle2, Shield,
  Pill, FileText, Send, CreditCard, Clock, Loader2, AlertCircle,
  Paperclip, ExternalLink, Package, History, Download, User, Droplets, TriangleAlert,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const STUN = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

async function sendSignal(consultationId: number, fromRole: string, toRole: string, signal: unknown) {
  await fetch(`${BASE_URL}/api/webrtc/signal/${consultationId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fromRole, toRole, signal }),
  });
}

async function pollSignals(consultationId: number, role: string): Promise<{ fromRole: string; signal: unknown }[]> {
  const res = await fetch(`${BASE_URL}/api/webrtc/signal/${consultationId}/${role}`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export default function ConsultationRoom() {
  const [, params] = useRoute("/:role/consultation/:id");
  const [, setLocation] = useLocation();
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const id = parseInt(params?.id || "0");
  const { data: consultation, isLoading } = useGetConsultation(id, {
    query: { enabled: !!id, refetchInterval: 3000 },
  });

  const payMutation = useCreatePayment();
  const confirmMutation = useConfirmPayment();
  const completeMutation = useCompleteConsultation();
  const prescribeMutation = useSendPrescription();
  const medMutation = useSendMedication();
  const updateMedMutation = useUpdateMedicationStatus();

  const [activeTab, setActiveTab] = useState<"video" | "prescriptions" | "medications" | "history">("video");
  const [patientHistory, setPatientHistory] = useState<{ patient: any; consultations: any[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "history" && role === "doctor" && id && !patientHistory && !historyLoading) {
      setHistoryLoading(true);
      fetch(`${BASE_URL}/api/consultations/${id}/patient-history`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setPatientHistory(data); })
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    }
  }, [activeTab, role, id, patientHistory, historyLoading]);

  const [prescriptionText, setPrescriptionText] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [medsText, setMedsText] = useState("");
  const [medDeliveryNotes, setMedDeliveryNotes] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setDocumentUrl(data.url);
      setUploadedFileName(data.filename);
      toast({ title: "File Uploaded", description: `${data.filename} is ready to attach.` });
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Please try again." });
    } finally {
      setUploadingFile(false);
    }
  };

  // Payment simulation mode
  const [paymentMode, setPaymentMode] = useState<"success" | "decline">("success");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // WebRTC state
  const [inCall, setInCall] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [vidOn, setVidOn] = useState(true);
  const [callError, setCallError] = useState<string | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null); // stores remote stream for late-mount
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isInitiatorRef = useRef(false); // doctor = initiator

  // Apply remote stream to video element as soon as both are ready
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [remoteConnected]);

  // Apply LOCAL stream once the video element mounts (after setInCall(true))
  useEffect(() => {
    if (inCall && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [inCall]);

  const stopCall = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setInCall(false);
    setRemoteConnected(false);
  }, []);

  const handleEndCall = useCallback(() => {
    stopCall();
    if (role === "doctor") {
      completeMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/consultations/${id}`] }),
      });
    } else {
      setLocation("/patient/dashboard");
    }
  }, [role, id, stopCall, completeMutation, queryClient, setLocation]);

  // Toggle mic/cam
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !micOn; });
    setMicOn(!micOn);
  };
  const toggleVid = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !vidOn; });
    setVidOn(!vidOn);
  };

  const startWebRTC = useCallback(async () => {
    setCallError(null);
    isInitiatorRef.current = role === "doctor";

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      setCallError("Camera/microphone access denied. Please allow permissions and try again.");
      return;
    }

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const pc = new RTCPeerConnection(STUN);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (evt) => {
      if (evt.streams[0]) {
        remoteStreamRef.current = evt.streams[0];
        // Apply immediately if the video element is already mounted
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = evt.streams[0];
        }
        setRemoteConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setRemoteConnected(true);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setCallError("Connection lost. Please try again.");
      }
    };

    pc.onicecandidate = async (evt) => {
      if (evt.candidate) {
        const toRole = role === "doctor" ? "patient" : "doctor";
        await sendSignal(id, role!, toRole, { type: "candidate", candidate: evt.candidate });
      }
    };

    // ICE connection state — attempt restart on failure
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    // Start polling for signals (fast 500ms to reduce call setup latency)
    pollIntervalRef.current = setInterval(async () => {
      const signals = await pollSignals(id, role!);
      for (const sig of signals) {
        const s = sig.signal as any;
        if (s.type === "offer" && !isInitiatorRef.current) {
          await pc.setRemoteDescription(new RTCSessionDescription(s.sdp));
          // Drain any buffered candidates
          for (const c of iceCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
          iceCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(id, role!, "doctor", { type: "answer", sdp: answer });
        } else if (s.type === "answer" && isInitiatorRef.current) {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(s.sdp));
          }
        } else if (s.type === "candidate") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(s.candidate));
          } else {
            iceCandidatesRef.current.push(s.candidate);
          }
        }
      }
    }, 500);

    // Doctor creates offer
    if (isInitiatorRef.current) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(id, "doctor", "patient", { type: "offer", sdp: offer });
    }

    setInCall(true);
  }, [id, role]);

  // Cleanup on unmount
  useEffect(() => () => stopCall(), [stopCall]);

  // ── Payment ──────────────────────────────────────────────────────────────
  const handlePayment = () => {
    setPaymentError(null);
    if (paymentMode === "decline") {
      // Simulate a card declined error — do not call confirm
      setTimeout(() => {
        setPaymentError("Your card was declined. Please use a different payment method or try again.");
      }, 1000);
      return;
    }
    payMutation.mutate({ id }, {
      onSuccess: () => {
        confirmMutation.mutate({ id }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/consultations/${id}`] });
            toast({ title: "Payment Successful", description: "You can now join the call." });
          },
        });
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  const handleSendPrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescriptionText.trim() && !documentUrl.trim()) return;
    prescribeMutation.mutate({
      id,
      data: {
        content: prescriptionText || "Document attached",
        documentUrl: documentUrl || undefined,
      } as any,
    }, {
      onSuccess: () => {
        setPrescriptionText("");
        setDocumentUrl("");
        setUploadedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        queryClient.invalidateQueries({ queryKey: [`/api/consultations/${id}`] });
        toast({ title: "Prescription Sent" });
      },
    });
  };

  const handleSendMeds = (e: React.FormEvent) => {
    e.preventDefault();
    const list = medsText.split(",").map((s) => s.trim()).filter(Boolean);
    medMutation.mutate({ id, data: { medications: list, pharmacyName: "PharmaSense Rx" } }, {
      onSuccess: () => {
        setMedsText("");
        queryClient.invalidateQueries({ queryKey: [`/api/consultations/${id}`] });
        toast({ title: "Medication Ordered" });
      },
    });
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || !consultation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── State: PENDING — waiting for doctor to accept ─────────────────────────
  if (consultation.status === "pending") {
    return (
      <PageTransition className="max-w-xl mx-auto mt-16">
        <Card className="p-12 text-center shadow-xl">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Clock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-3">Waiting for Doctor</h2>
          <p className="text-muted-foreground mb-2">
            Your request has been sent to <span className="font-semibold text-foreground">Dr. {consultation.doctor?.name}</span>.
          </p>
          <p className="text-sm text-muted-foreground">This page will update automatically when the doctor accepts.</p>
          <div className="mt-8 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </Card>
      </PageTransition>
    );
  }

  // ── State: ACCEPTED — patient needs to pay ────────────────────────────────
  if (role === "patient" && consultation.status === "accepted" && consultation.paymentStatus !== "paid") {
    const fee = consultation.doctor?.consultationFee ?? 500;
    return (
      <PageTransition className="max-w-lg mx-auto mt-12">
        <Card className="p-10 shadow-xl">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-center mb-1">Request Accepted!</h2>
          <p className="text-muted-foreground text-center mb-8">Dr. {consultation.doctor?.name} is ready for your consultation.</p>

          {/* Test Payment Mode Selector */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Simulate Payment Outcome</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setPaymentMode("success"); setPaymentError(null); }}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${paymentMode === "success" ? "border-green-500 bg-green-500/10 text-green-400" : "border-border bg-secondary text-muted-foreground hover:border-green-500/50"}`}
              >
                <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: paymentMode === "success" ? "#22c55e" : "#d1d5db" }}>
                  {paymentMode === "success" && <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
                </span>
                <span>✓ Successful</span>
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMode("decline"); setPaymentError(null); }}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${paymentMode === "decline" ? "border-red-500 bg-red-500/10 text-red-400" : "border-border bg-secondary text-muted-foreground hover:border-red-500/50"}`}
              >
                <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: paymentMode === "decline" ? "#ef4444" : "#d1d5db" }}>
                  {paymentMode === "decline" && <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />}
                </span>
                <span>✗ Declined</span>
              </button>
            </div>
          </div>

          {/* Auto-filled Test Card */}
          <div className={`border-2 rounded-2xl overflow-hidden mb-5 transition-colors ${paymentMode === "decline" ? "border-red-200" : "border-green-200"}`}>
            <div className={`px-5 py-3 flex items-center gap-2 border-b ${paymentMode === "decline" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <CreditCard className={`w-4 h-4 ${paymentMode === "decline" ? "text-red-600" : "text-green-600"}`} />
              <span className="font-bold text-sm">
                {paymentMode === "decline" ? "Test Card — Will Decline" : "Test Card — Will Succeed"}
              </span>
              <Badge variant="outline" className="ml-auto text-xs border-primary/30 text-primary">STRIPE TEST</Badge>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Card Number</label>
                <div className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm font-mono tracking-widest ${paymentMode === "decline" ? "border-red-200 bg-red-50/50 text-red-700" : "border-green-200 bg-green-50/50 text-green-700"}`}>
                  {paymentMode === "decline" ? "4000 0000 0000 0002" : "4242 4242 4242 4242"}
                  <span className="ml-auto text-xs font-sans opacity-60">VISA</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Expiry</label>
                  <div className="px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm font-mono">12 / 28</div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">CVC</label>
                  <div className="px-3 py-2.5 border border-border rounded-xl bg-muted/30 text-sm font-mono">123</div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border bg-secondary/30 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Consultation Fee</span>
              <span className="text-xl font-bold">₹{fee}</span>
            </div>
          </div>

          {/* Payment error */}
          {paymentError && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          <Button
            size="lg"
            className={`w-full text-base h-13 ${paymentMode === "decline" ? "bg-red-600 hover:bg-red-700 border-0" : ""}`}
            onClick={handlePayment}
            isLoading={payMutation.isPending || confirmMutation.isPending}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {paymentMode === "decline" ? "Test Declined Payment" : `Pay ₹${fee} — Join Consultation`}
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" /> Stripe test environment — no real charges
          </p>
        </Card>
      </PageTransition>
    );
  }

  // ── State: ACCEPTED — doctor waiting for patient payment ──────────────────
  if (role === "doctor" && consultation.status === "accepted" && consultation.paymentStatus !== "paid") {
    return (
      <PageTransition className="max-w-xl mx-auto mt-16 text-center">
        <Card className="p-12">
          <Loader2 className="w-14 h-14 text-primary animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2">Waiting for Patient Payment</h2>
          <p className="text-muted-foreground">The consultation room will open automatically once the patient pays.</p>
        </Card>
      </PageTransition>
    );
  }

  // ── State: ACTIVE / COMPLETED ROOM ───────────────────────────────────────
  return (
    <PageTransition className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">

      {/* Video Area */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        <div className="flex items-center justify-between bg-card px-5 py-3 rounded-2xl shadow-sm border border-border shrink-0">
          <div className="flex items-center gap-3">
            <Badge
              variant={consultation.status === "completed" ? "default" : "success"}
              className="px-3 py-1"
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${consultation.status === "completed" ? "bg-gray-400" : "bg-green-500 animate-pulse"}`} />
              {consultation.status === "completed" ? "Completed" : "Live Consultation"}
            </Badge>
            <span className="font-bold text-foreground">
              {role === "doctor" ? `Patient: ${consultation.patient?.name}` : `Dr. ${consultation.doctor?.name}`}
            </span>
          </div>
          {inCall && remoteConnected && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" /> Connected
            </span>
          )}
        </div>

        <Card className="flex-1 bg-gray-900 border-0 overflow-hidden relative shadow-2xl flex flex-col min-h-0">
          {inCall ? (
            <div className="flex-1 relative">
              {/* Remote video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              {!remoteConnected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 text-white gap-3">
                  <Loader2 className="w-10 h-10 animate-spin opacity-60" />
                  <p className="text-sm opacity-60">Connecting to the other side…</p>
                </div>
              )}
              {remoteConnected && (
                <div className="absolute bottom-20 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm backdrop-blur-md">
                  {role === "doctor" ? consultation.patient?.name : `Dr. ${consultation.doctor?.name}`}
                </div>
              )}

              {/* Local video (picture-in-picture) */}
              <div className="absolute top-4 right-4 w-44 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 bg-gray-700">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!vidOn && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <VideoOff className="text-white w-7 h-7" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 text-white text-xs bg-black/40 px-2 py-0.5 rounded-md">You</div>
              </div>

              {/* Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl p-3 rounded-full border border-white/10">
                <button
                  onClick={toggleMic}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micOn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 text-white"}`}
                >
                  {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleVid}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${vidOn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-red-500 text-white"}`}
                >
                  {vidOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleEndCall}
                  className="w-16 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-500/20"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6">
                <Video className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {consultation.status === "completed" ? "Consultation Ended" : "Ready to join?"}
              </h3>
              {consultation.status !== "completed" && (
                <>
                  <p className="text-gray-400 mb-2 max-w-md">
                    Your browser will ask for camera and microphone access. Please allow them to join.
                  </p>
                  {callError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-950/30 px-4 py-2 rounded-xl">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {callError}
                    </div>
                  )}
                  <Button
                    size="lg"
                    className="px-12 bg-green-500 hover:bg-green-600 border-0 text-white mt-4"
                    onClick={startWebRTC}
                  >
                    <Video className="w-4 h-4 mr-2" /> Join Call
                  </Button>
                  <p className="text-gray-500 text-xs mt-3">
                    {role === "doctor" ? "You will initiate the connection once you join." : "Wait for the doctor to join first or join to be ready."}
                  </p>
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Clinical Panel */}
      <div className="w-full md:w-96 flex flex-col bg-card rounded-2xl shadow-sm border border-border overflow-hidden h-[480px] md:h-auto shrink-0">
        <div className="flex border-b border-border bg-secondary/30 shrink-0">
          {(["video", "prescriptions", "medications", ...(role === "doctor" ? ["history"] : [])] as const).map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setActiveTab(tab as any)}
            >
              {tab === "video" ? "Info" : tab === "prescriptions" ? "Rx" : tab === "medications" ? "Meds" : (
                <span className="flex items-center justify-center gap-1"><History className="w-3 h-3" />History</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {activeTab === "video" && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Chief Complaint</h4>
                <div className="p-3 bg-secondary rounded-xl text-sm">{consultation.symptoms}</div>
              </div>
              {consultation.notes && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Patient Notes</h4>
                  <div className="p-3 bg-secondary/50 border border-border rounded-xl text-sm">{consultation.notes}</div>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium p-3 bg-green-50 rounded-xl border border-green-100">
                <Shield className="w-4 h-4" /> WebRTC end-to-end encrypted
              </div>
            </div>
          )}

          {activeTab === "prescriptions" && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {consultation.prescriptions?.map((p) => (
                  <div key={p.id} className="p-3 border border-border rounded-xl bg-secondary shadow-sm">
                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-sm">
                      <FileText className="w-4 h-4" /> Prescription
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{p.content}</p>
                    {p.documentUrl && (
                      <a href={p.documentUrl} download rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-primary text-xs font-medium hover:underline">
                        <ExternalLink className="w-3 h-3" /> Download Document
                      </a>
                    )}
                    {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                  </div>
                ))}
                {(!consultation.prescriptions || consultation.prescriptions.length === 0) && (
                  <div className="text-center text-muted-foreground text-sm mt-8">No prescriptions yet.</div>
                )}
              </div>
              {role === "doctor" && consultation.status !== "completed" && (
                <form onSubmit={handleSendPrescription} className="mt-auto pt-4 border-t border-border shrink-0 space-y-2">
                  <textarea
                    value={prescriptionText}
                    onChange={(e) => setPrescriptionText(e.target.value)}
                    placeholder="Write prescription notes (optional if attaching file)..."
                    className="w-full text-sm p-3 border border-border rounded-xl resize-none focus:ring-2 focus:ring-primary outline-none bg-secondary text-foreground"
                    rows={2}
                  />
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  />
                  {uploadedFileName ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-xl text-xs text-primary">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1">{uploadedFileName}</span>
                      <button type="button" onClick={() => { setDocumentUrl(""); setUploadedFileName(null); }} className="text-muted-foreground hover:text-destructive transition-colors">✕</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs border border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      {uploadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                      {uploadingFile ? "Uploading…" : "Attach file (PDF, image, Word, text)"}
                    </button>
                  )}
                  <Button type="submit" className="w-full h-10" disabled={!prescriptionText.trim() && !documentUrl.trim()} isLoading={prescribeMutation.isPending}>
                    <Send className="w-4 h-4 mr-2" /> Send Rx
                  </Button>
                </form>
              )}
            </div>
          )}

          {activeTab === "medications" && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {consultation.medications?.map((m) => (
                  <div key={m.id} className="p-3 border border-border rounded-xl bg-card shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-accent font-bold text-sm">
                        <Pill className="w-4 h-4" /> Order
                      </div>
                      <Badge variant={m.deliveryStatus === "delivered" ? "success" : "outline"} className="capitalize text-xs">{m.deliveryStatus}</Badge>
                    </div>
                    <div className="text-sm font-medium">{m.medications.join(", ")}</div>
                    {m.instructions && <div className="text-xs text-muted-foreground mt-1">{m.instructions}</div>}
                    {(m as any).deliveryNote && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs bg-secondary p-2 rounded-lg">
                        <Package className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{(m as any).deliveryNote}</span>
                      </div>
                    )}
                    {role === "doctor" && m.deliveryStatus !== "delivered" && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <select
                          className="text-xs border rounded-lg px-2 py-1.5 w-full"
                          value={m.deliveryStatus}
                          onChange={(e) => {
                            const newStatus = e.target.value;
                            const note = medDeliveryNotes[m.id] || "";
                            updateMedMutation.mutate(
                              { id, medId: m.id, data: { deliveryStatus: newStatus as any, deliveryNote: note || undefined } as any },
                              { onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/consultations/${id}`] }) }
                            );
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                        </select>
                        <input
                          value={medDeliveryNotes[m.id] || ""}
                          onChange={e => setMedDeliveryNotes(prev => ({ ...prev, [m.id]: e.target.value }))}
                          placeholder="Delivery note…"
                          className="w-full text-xs border border-border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {(!consultation.medications || consultation.medications.length === 0) && (
                  <div className="text-center text-muted-foreground text-sm mt-8">No medications ordered.</div>
                )}
              </div>
              {role === "doctor" && consultation.status !== "completed" && (
                <form onSubmit={handleSendMeds} className="mt-auto pt-4 border-t border-border shrink-0">
                  <Input
                    placeholder="Meds (comma separated)"
                    value={medsText}
                    onChange={(e) => setMedsText(e.target.value)}
                    className="mb-2 h-10 text-sm"
                  />
                  <Button
                    type="submit"
                    className="w-full h-10 bg-accent hover:bg-accent/90 border-0 text-white"
                    disabled={!medsText.trim()}
                    isLoading={medMutation.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" /> Order Meds
                  </Button>
                </form>
              )}
            </div>
          )}

          {activeTab === "history" && role === "doctor" && (
            <div className="space-y-4">
              {historyLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading patient history…
                </div>
              )}
              {!historyLoading && !patientHistory && (
                <div className="text-center text-muted-foreground text-sm py-10">Could not load history.</div>
              )}
              {!historyLoading && patientHistory && (
                <>
                  {/* Patient Profile Card */}
                  <div className="p-3 rounded-xl bg-secondary border border-border space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm">{patientHistory.patient.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                      {patientHistory.patient.phone && <span>📞 {patientHistory.patient.phone}</span>}
                      {patientHistory.patient.region && <span>📍 {patientHistory.patient.region}</span>}
                      {patientHistory.patient.language && <span>🗣 {patientHistory.patient.language}</span>}
                      {patientHistory.patient.bloodGroup && (
                        <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-red-400" />{patientHistory.patient.bloodGroup}</span>
                      )}
                    </div>
                    {patientHistory.patient.allergies && (
                      <div className="flex items-start gap-1.5 text-xs bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-lg p-2 mt-1">
                        <TriangleAlert className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                        <div><span className="font-semibold text-orange-700 dark:text-orange-400">Allergies: </span><span className="text-orange-600 dark:text-orange-300">{patientHistory.patient.allergies}</span></div>
                      </div>
                    )}
                    {patientHistory.patient.medicalHistory && (
                      <div className="text-xs text-muted-foreground border-t border-border pt-2 mt-1">
                        <span className="font-semibold text-foreground">Medical History: </span>{patientHistory.patient.medicalHistory}
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-2">
                    Consultation Timeline ({patientHistory.consultations.length})
                  </div>
                  {patientHistory.consultations.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-6">No past consultations.</div>
                  )}
                  <div className="space-y-3">
                    {patientHistory.consultations.map((con: any) => (
                      <div key={con.id} className="border border-border rounded-xl overflow-hidden">
                        <div className={`px-3 py-2 flex items-center justify-between ${con.status === "completed" ? "bg-green-50 dark:bg-green-950/30" : "bg-secondary"}`}>
                          <div>
                            <div className="text-xs font-bold text-foreground">{con.doctorName}</div>
                            <div className="text-xs text-muted-foreground">{con.doctorSpecialty}</div>
                          </div>
                          <div className="text-right">
                            <Badge variant={con.status === "completed" ? "success" : "outline"} className="text-xs capitalize mb-0.5">{con.status}</Badge>
                            <div className="text-xs text-muted-foreground">{con.createdAt ? format(new Date(con.createdAt), "dd MMM yyyy") : "—"}</div>
                          </div>
                        </div>
                        <div className="p-3 space-y-2 bg-card">
                          <div className="text-xs"><span className="font-semibold text-muted-foreground">Symptoms: </span>{con.symptoms}</div>
                          {con.notes && <div className="text-xs text-muted-foreground italic">{con.notes}</div>}
                          {con.prescriptions?.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-border">
                              {con.prescriptions.map((p: any) => (
                                <div key={p.id} className="flex items-start gap-1.5 text-xs">
                                  <FileText className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                                  <div className="flex-1">
                                    {p.content && <span>{p.content}</span>}
                                    {p.documentUrl && (
                                      <a href={p.documentUrl} download rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline ml-1">
                                        <Download className="w-3 h-3" />Doc
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {con.medications?.length > 0 && (
                            <div className="pt-1 border-t border-border space-y-1">
                              {con.medications.map((m: any) => (
                                <div key={m.id} className="flex items-center gap-1.5 text-xs">
                                  <Pill className="w-3 h-3 text-accent shrink-0" />
                                  <span>{m.medications?.join(", ")}</span>
                                  <Badge variant={m.deliveryStatus === "delivered" ? "success" : "outline"} className="text-xs ml-auto">{m.deliveryStatus}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
