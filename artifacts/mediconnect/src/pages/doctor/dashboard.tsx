import { useAuth } from "@/lib/auth";
import { useGetDoctorNotifications, useUpdateAvailability, useRespondToConsultation } from "@workspace/api-client-react";
import { PageTransition, Card, Button, Badge } from "@/components/ui-elements";
import { Bell, Activity, CheckCircle2, XCircle, Power, Video, Users, ClipboardList, RefreshCw, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function DoctorDashboard() {
  const { user, refreshAuth } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [reverifyState, setReverifyState] = useState<"idle" | "loading" | "success" | "unreachable" | "not_found">("idle");
  const [reverifyMsg, setReverifyMsg] = useState("");

  const { data: requests, isLoading } = useGetDoctorNotifications();
  const updateAvail = useUpdateAvailability();
  const respondReq = useRespondToConsultation();

  const handleReverify = async () => {
    setReverifyState("loading");
    try {
      const res = await fetch(`${BASE_URL}/api/auth/nmc-reverify`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.status === 503 || data.unreachable) {
        setReverifyState("unreachable");
        setReverifyMsg(data.message || "NMC server still unreachable. Try again in a few minutes.");
      } else if (data.verified || data.alreadyVerified) {
        setReverifyState("success");
        setReverifyMsg(data.message || "NMC verified successfully!");
        await refreshAuth();
      } else {
        setReverifyState("not_found");
        setReverifyMsg(data.message || "Registration not found in NMC records.");
      }
    } catch {
      setReverifyState("unreachable");
      setReverifyMsg("Could not reach the server. Please try again.");
    }
  };

  const toggleStatus = () => {
    updateAvail.mutate({ data: { isOnline: !user.isOnline } }, {
      onSuccess: () => refreshAuth()
    });
  };

  const handleRespond = (id: number, status: 'accepted' | 'rejected') => {
    respondReq.mutate({ id, data: { status } }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: ['/api/doctors/notifications'] });
        if (status === 'accepted') {
          setLocation(`/doctor/consultation/${res.id}`);
        }
      }
    });
  };

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];

  return (
    <PageTransition className="max-w-5xl mx-auto space-y-6">
      
      {/* Verification Banner */}
      {user.verificationStatus === 'pending' && reverifyState !== 'success' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-5 rounded-xl">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 shrink-0 mt-0.5 text-yellow-400" />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-yellow-400">Verification Pending</h4>
              <p className="text-sm mt-1 text-yellow-400/80">
                Your NMC registration could not be verified automatically. You cannot accept consultations until an admin approves you — or you can retry NMC verification below if the server was temporarily down.
              </p>

              {/* Retry result messages */}
              {reverifyState === 'unreachable' && (
                <p className="text-sm mt-2 text-orange-400">{reverifyMsg}</p>
              )}
              {reverifyState === 'not_found' && (
                <p className="text-sm mt-2 text-red-400">{reverifyMsg}</p>
              )}

              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                  onClick={handleReverify}
                  isLoading={reverifyState === 'loading'}
                  disabled={reverifyState === 'loading'}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" />
                  {reverifyState === 'loading' ? 'Contacting NMC...' : 'Retry NMC Verification'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success banner after re-verify */}
      {reverifyState === 'success' && (
        <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <h4 className="font-bold text-green-400">NMC Verified!</h4>
            <p className="text-sm text-green-400/80 mt-0.5">{reverifyMsg}</p>
          </div>
        </div>
      )}

      {/* Header Stat Card */}
      <Card className="p-8 bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg shadow-primary/20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Welcome, Dr. {user.name}</h1>
            <p className="text-white/80">Manage your consultations and patient requests here.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 flex items-center gap-4">
            <div>
              <div className="text-sm text-white/70 font-medium mb-1">Current Status</div>
              <div className="flex items-center gap-2 font-bold text-lg">
                <span className={`w-3 h-3 rounded-full ${user.isOnline ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'bg-gray-400'}`}></span>
                {user.isOnline ? 'Online & Available' : 'Offline'}
              </div>
            </div>
            <Button 
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 border-0"
              onClick={toggleStatus}
              disabled={user.verificationStatus === 'pending'}
              isLoading={updateAvail.isPending}
            >
              <Power className="w-4 h-4 mr-2" />
              Go {user.isOnline ? 'Offline' : 'Online'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <button className="text-left" onClick={() => setLocation('/doctor/patients')}>
          <Card hover className="p-5 flex items-center gap-4 cursor-pointer group">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold">Patient Records</div>
              <div className="text-xs text-muted-foreground">View all your patients</div>
            </div>
          </Card>
        </button>
        <button className="text-left" onClick={() => setLocation('/doctor/profile')}>
          <Card hover className="p-5 flex items-center gap-4 cursor-pointer group">
            <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold">My Profile</div>
              <div className="text-xs text-muted-foreground">Update specialty & info</div>
            </div>
          </Card>
        </button>
        <Card className="p-5 flex items-center gap-4 col-span-2 md:col-span-1">
          <div className="w-12 h-12 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold">{pendingRequests.length} Pending</div>
            <div className="text-xs text-muted-foreground">Incoming consultation requests</div>
          </div>
        </Card>
      </div>

      {/* Incoming Requests */}
      <h2 className="text-2xl font-bold flex items-center gap-2 mt-8">
        <Bell className="w-6 h-6 text-primary" />
        Incoming Requests
        {pendingRequests.length > 0 && (
          <span className="bg-destructive text-white text-xs px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
        )}
      </h2>

      {isLoading ? (
        <Card className="h-32 animate-pulse bg-muted/50 p-6" />
      ) : pendingRequests.length === 0 ? (
        <Card className="p-12 text-center border-dashed flex flex-col items-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-lg font-bold">No active requests</h3>
          <p className="text-muted-foreground">Make sure your status is set to Online to receive patients.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingRequests.map(req => (
            <Card key={req.id} className="p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center border-l-4 border-l-primary shadow-md">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold">{req.patientName || 'Patient'}</h3>
                  <Badge variant="warning">Waiting for Response</Badge>
                </div>
                <div className="text-sm font-medium mb-1">Symptoms:</div>
                <p className="text-foreground bg-muted p-3 rounded-lg text-sm">{req.symptoms}</p>
                {req.notes && <p className="text-sm text-muted-foreground mt-2"><span className="font-semibold">Notes:</span> {req.notes}</p>}
              </div>

              <div className="flex w-full md:w-auto gap-3 shrink-0">
                <Button 
                  variant="outline" 
                  className="flex-1 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  onClick={() => handleRespond(req.id, 'rejected')}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700 shadow-green-600/20 text-white border-0"
                  onClick={() => handleRespond(req.id, 'accepted')}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Accept & Call
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
