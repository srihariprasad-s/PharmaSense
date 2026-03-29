import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSearchDoctors } from "@workspace/api-client-react";
import { PageTransition, Card, Button, Badge } from "@/components/ui-elements";
import { Search, Filter, Star, MapPin, Languages, CheckCircle2, Clock } from "lucide-react";
import { SPECIALTIES } from "@/lib/specialties";

export default function PatientDoctorsSearch() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [params, setParams] = useState({
    symptom: searchParams.get('symptom') || '',
    specialty: searchParams.get('specialty') || '',
    onlineOnly: searchParams.get('onlineOnly') === 'true',
  });

  const { data: doctors, isLoading } = useSearchDoctors({
    symptom: params.symptom || undefined,
    specialty: params.specialty || undefined,
    onlineOnly: params.onlineOnly || undefined,
  });

  const updateSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (params.symptom) q.set('symptom', params.symptom);
    if (params.specialty) q.set('specialty', params.specialty);
    if (params.onlineOnly) q.set('onlineOnly', 'true');
    setLocation(`/patient/doctors?${q.toString()}`);
  };

  return (
    <PageTransition className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6">
      
      {/* Filter Sidebar */}
      <div className="w-full md:w-72 flex-shrink-0 space-y-6">
        <Card className="p-5 sticky top-24">
          <div className="flex items-center gap-2 font-bold text-lg mb-6 pb-4 border-b">
            <Filter className="w-5 h-5" /> Filters
          </div>

          <form onSubmit={updateSearch} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Symptom or Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={params.symptom}
                  onChange={(e) => setParams({...params, symptom: e.target.value})}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Fever"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Specialty</label>
              <select 
                value={params.specialty}
                onChange={(e) => setParams({...params, specialty: e.target.value})}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">All Specialties</option>
                {SPECIALTIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <input 
                type="checkbox" 
                id="online"
                checked={params.onlineOnly}
                onChange={(e) => setParams({...params, onlineOnly: e.target.checked})}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="online" className="text-sm font-medium cursor-pointer flex-1">
                Online Now
              </label>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>

            <Button type="submit" className="w-full">Apply Filters</Button>
          </form>
        </Card>
      </div>

      {/* Results */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Search Results</h2>
          <span className="text-muted-foreground text-sm font-medium">{doctors?.length || 0} doctors found</span>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <Card key={i} className="p-6 h-40 animate-pulse bg-muted/50" />
            ))}
          </div>
        ) : doctors?.length === 0 ? (
          <Card className="p-12 text-center flex flex-col items-center justify-center border-dashed">
            <Search className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-bold">No doctors found</h3>
            <p className="text-muted-foreground">Try adjusting your search filters.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {doctors?.map(doctor => (
              <Card key={doctor.id} hover className="p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20">
                    <img src={`${import.meta.env.BASE_URL}images/doctor-illustration.png`} alt="Doctor" className="w-full h-full object-cover" />
                  </div>
                  {doctor.isOnline && (
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold">{doctor.name}</h3>
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-primary font-medium text-sm mb-2">{doctor.specialty}</div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3">
                    <div className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> {doctor.experience} yrs exp</div>
                    <div className="flex items-center gap-1.5"><Star className="w-4 h-4 text-yellow-400 fill-current"/> {doctor.rating || 'New'}</div>
                    {doctor.regions && doctor.regions.length > 0 && (
                      <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4"/> {doctor.regions[0]}</div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    {doctor.isSameLanguage && <Badge variant="success">Speaks your language</Badge>}
                    {doctor.isSameRegion && <Badge variant="default">In your region</Badge>}
                  </div>
                </div>

                <div className="w-full sm:w-auto flex flex-col items-end gap-3 sm:border-l sm:pl-6 border-border">
                  <div className="text-right w-full flex flex-row sm:flex-col justify-between items-center sm:items-end">
                    <span className="text-sm text-muted-foreground">Consultation Fee</span>
                    <span className="text-xl font-bold text-foreground">${doctor.consultationFee || 50}</span>
                  </div>
                  <Button onClick={() => setLocation(`/patient/doctor/${doctor.id}`)} className="w-full">
                    View Profile
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
