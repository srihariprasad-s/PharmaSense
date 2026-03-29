import { useState } from "react";
import { useLocation } from "wouter";
import { PageTransition, Card, Button, Input } from "@/components/ui-elements";
import { Search, Activity, Stethoscope, Video, Heart, Calendar } from "lucide-react";

export default function PatientDashboard() {
  const [, setLocation] = useLocation();
  const [symptom, setSymptom] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (symptom.trim()) {
      setLocation(`/patient/doctors?symptom=${encodeURIComponent(symptom)}`);
    }
  };

  const commonSpecialties = [
    "General Physician", "Cardiologist", "Dermatologist", "Pediatrician", "Psychiatrist"
  ];

  return (
    <PageTransition className="space-y-8 max-w-5xl mx-auto">
      
      {/* Search Hero */}
      <div className="bg-primary rounded-3xl p-8 md:p-12 text-white relative overflow-hidden shadow-xl shadow-primary/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-display font-bold mb-4">How are you feeling today?</h1>
          <p className="text-primary-foreground/80 text-lg mb-8">Search for doctors by symptoms, specialty, or condition.</p>
          
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text"
                placeholder="e.g. Headache, fever, cardiologist..."
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                className="w-full h-14 pl-12 pr-4 rounded-2xl text-foreground bg-white border-0 focus:ring-4 focus:ring-white/30 shadow-lg text-lg"
              />
            </div>
            <Button type="submit" size="lg" className="h-14 px-8 bg-accent hover:bg-accent/90 text-white rounded-2xl shadow-lg shadow-accent/20">
              Find Doctors
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-white/70 py-1">Popular:</span>
            {commonSpecialties.map(spec => (
              <button 
                key={spec}
                onClick={() => setLocation(`/patient/doctors?specialty=${encodeURIComponent(spec)}`)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-sm font-medium transition-colors border border-white/10"
              >
                {spec}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Video, label: "Online Consult", color: "bg-blue-500", text: "text-blue-500" },
          { icon: Calendar, label: "Book Clinic", color: "bg-purple-500", text: "text-purple-500" },
          { icon: Stethoscope, label: "Specialists", color: "bg-teal-500", text: "text-teal-500" },
          { icon: Heart, label: "Health Check", color: "bg-rose-500", text: "text-rose-500" }
        ].map((action, i) => (
          <Card key={i} hover className="p-6 flex flex-col items-center justify-center text-center cursor-pointer group">
            <div className={`w-14 h-14 rounded-2xl ${action.color}/10 ${action.text} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <action.icon className="w-7 h-7" />
            </div>
            <span className="font-semibold text-foreground">{action.label}</span>
          </Card>
        ))}
      </div>

      {/* Upcoming / Activity Widget (Mock) */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Recent Activity
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setLocation('/patient/records')}>View All</Button>
        </div>
        <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
          No recent consultations.
        </div>
      </Card>

    </PageTransition>
  );
}
