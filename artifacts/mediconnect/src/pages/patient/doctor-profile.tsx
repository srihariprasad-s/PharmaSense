import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetDoctorById, useCreateConsultationRequest } from "@workspace/api-client-react";
import { PageTransition, Card, Button, Badge, Input } from "@/components/ui-elements";
import { CheckCircle2, Star, MapPin, Languages, GraduationCap, Clock, Award, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DoctorProfile() {
  const [, params] = useRoute("/patient/doctor/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const doctorId = parseInt(params?.id || "0");
  const { data: doctor, isLoading } = useGetDoctorById(doctorId, { query: { enabled: !!doctorId } });
  const createReq = useCreateConsultationRequest();

  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  if (isLoading) return <div className="p-8 text-center">Loading profile...</div>;
  if (!doctor) return <div className="p-8 text-center text-destructive">Doctor not found</div>;

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    createReq.mutate({
      data: { doctorId, symptoms, notes }
    }, {
      onSuccess: (res) => {
        toast({ title: "Request Sent!", description: "Waiting for doctor to accept." });
        setLocation(`/patient/consultation/${res.id}`);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed", description: err.message });
      }
    });
  };

  return (
    <PageTransition className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-secondary flex items-center justify-center border-4 border-white shadow-lg overflow-hidden shrink-0">
             <img src={`${import.meta.env.BASE_URL}images/doctor-illustration.png`} alt="Doctor" className="w-full h-full object-cover" />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-display font-bold">{doctor.name}</h1>
              {doctor.verificationStatus === 'approved' && (
                <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" /> NMC Verified</Badge>
              )}
            </div>
            
            <p className="text-xl text-primary font-medium mb-4">{doctor.specialty} {doctor.subSpecialty ? `• ${doctor.subSpecialty}` : ''}</p>
            
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm text-muted-foreground mb-6">
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-foreground/50"/> {doctor.experience} Years Experience</div>
              <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-foreground/50"/> {doctor.education || 'MBBS, MD'}</div>
              <div className="flex items-center gap-2"><Languages className="w-4 h-4 text-foreground/50"/> {doctor.languages?.join(", ") || 'English'}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-foreground/50"/> {doctor.regions?.join(", ") || 'Global'}</div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-secondary rounded-2xl">
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Consultation Fee</div>
                <div className="text-2xl font-bold">${doctor.consultationFee || 50}</div>
              </div>
              <div className="h-10 w-px bg-border"></div>
              <div className="flex-1 pl-4">
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="font-semibold flex items-center gap-2">
                  {doctor.isOnline ? (
                    <><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Available Now</>
                  ) : (
                    <><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> Offline</>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 md:p-8">
            <h2 className="text-xl font-bold mb-4">About Doctor</h2>
            <p className="text-muted-foreground leading-relaxed">
              {doctor.bio || "This doctor has not provided a detailed biography yet. They are a fully verified professional on the PharmaSense platform."}
            </p>
          </Card>
        </div>

        <div className="md:col-span-1">
          <Card className="p-6 sticky top-24 border-primary/20 shadow-lg shadow-primary/5">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Book Video Consult</h3>
            <p className="text-sm text-muted-foreground mb-6">Connect instantly via secure video call.</p>
            
            {!isRequesting ? (
              <Button 
                size="lg" 
                className="w-full" 
                onClick={() => setIsRequesting(true)}
                disabled={!doctor.isOnline}
              >
                {doctor.isOnline ? "Request Now" : "Currently Offline"}
              </Button>
            ) : (
              <form onSubmit={handleRequest} className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Symptoms *</label>
                  <textarea 
                    required
                    className="w-full p-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none resize-none"
                    rows={3}
                    placeholder="Briefly describe what you're feeling..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Any past medical history?</label>
                  <Input 
                    placeholder="Optional notes for doctor" 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsRequesting(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" isLoading={createReq.isPending}>Send Request</Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
