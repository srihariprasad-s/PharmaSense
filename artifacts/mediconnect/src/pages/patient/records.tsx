import { useGetPatientRecords } from "@workspace/api-client-react";
import { PageTransition, Card, Badge } from "@/components/ui-elements";
import { FileText, Calendar, Pill, Search, ExternalLink, Package } from "lucide-react";
import { format } from "date-fns";

export default function PatientRecords() {
  const { data: records, isLoading } = useGetPatientRecords();

  return (
    <PageTransition className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Medical Records</h1>
          <p className="text-muted-foreground mt-1">View your past consultations, prescriptions, and medications.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <Card key={i} className="h-48 animate-pulse bg-muted/50 p-6" />)}
        </div>
      ) : records?.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-bold">No records found</h3>
          <p className="text-muted-foreground">Your medical history will appear here after your first consultation.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {records?.map((record) => (
            <Card key={record.id} className="p-0 overflow-hidden">
              <div className="bg-secondary/50 p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shadow-sm">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold">{format(new Date(record.date || new Date()), 'MMMM d, yyyy')}</div>
                    <div className="text-sm text-muted-foreground">Dr. {record.doctorName} • {record.specialty}</div>
                  </div>
                </div>
                <Badge variant="outline">Consultation #{record.consultationId}</Badge>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Symptoms</h4>
                  <p className="text-foreground">{record.symptoms}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Prescriptions */}
                  <div className="p-4 rounded-xl border border-border bg-gray-50/50">
                    <h4 className="flex items-center gap-2 font-bold mb-3">
                      <FileText className="w-4 h-4 text-primary" /> Prescriptions
                    </h4>
                    {record.prescriptions && record.prescriptions.length > 0 ? (
                      <ul className="space-y-2">
                        {record.prescriptions.map(p => (
                          <li key={p.id} className="text-sm bg-secondary p-3 rounded-lg border shadow-sm">
                            <div className="font-medium mb-1">{p.content}</div>
                            {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                            {p.documentUrl && (
                              <a href={p.documentUrl} download rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-primary text-xs hover:underline font-medium">
                                <ExternalLink className="w-3 h-3" /> Download Document
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">No digital prescriptions issued.</div>
                    )}
                  </div>

                  {/* Medications */}
                  <div className="p-4 rounded-xl border border-border bg-gray-50/50">
                    <h4 className="flex items-center gap-2 font-bold mb-3">
                      <Pill className="w-4 h-4 text-accent" /> Medications Ordered
                    </h4>
                    {record.medications && record.medications.length > 0 ? (
                      <ul className="space-y-3">
                        {record.medications.map(m => (
                          <li key={m.id} className="text-sm bg-secondary p-3 rounded-lg border shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium text-primary">{m.pharmacyName || 'Standard Pharmacy'}</div>
                              <Badge variant={m.deliveryStatus === 'delivered' ? 'success' : 'warning'} className="capitalize text-[10px]">
                                {m.deliveryStatus}
                              </Badge>
                            </div>
                            <div className="text-foreground">{m.medications.join(", ")}</div>
                            {m.instructions && <div className="text-xs text-muted-foreground mt-1">{m.instructions}</div>}
                            {(m as any).deliveryNote && (
                              <div className="flex items-start gap-1.5 mt-2 text-xs bg-secondary p-2 rounded-lg">
                                <Package className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                                <span className="text-muted-foreground">{(m as any).deliveryNote}</span>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">No medication orders.</div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
