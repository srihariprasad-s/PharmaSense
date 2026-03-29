import { useGetPendingDoctors, useApproveDoctor, useRejectDoctor } from "@workspace/api-client-react";
import { PageTransition, Card, Button, Badge } from "@/components/ui-elements";
import { CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AdminDoctors() {
  const { data: doctors, isLoading } = useGetPendingDoctors();
  const approveMut = useApproveDoctor();
  const rejectMut = useRejectDoctor();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAction = (id: number, action: 'approve' | 'reject') => {
    const mut = action === 'approve' ? approveMut : rejectMut;
    const payload = action === 'reject' ? { id, data: { reason: "Manual rejection by admin" } } : { id };
    
    mut.mutate(payload as any, {
      onSuccess: () => {
        toast({ title: `Doctor ${action}d successfully` });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/doctors/pending'] });
      }
    });
  };

  return (
    <PageTransition className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold">Doctor Verifications</h1>
        <p className="text-muted-foreground mt-1">Review and approve doctors whose automatic NMC verification failed or requires manual review.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/50 p-6" />)}
        </div>
      ) : doctors?.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center border-dashed">
          <CheckCircle2 className="w-16 h-16 text-green-500/50 mb-4" />
          <h3 className="text-xl font-bold">All caught up!</h3>
          <p className="text-muted-foreground">There are no pending doctor verifications at the moment.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {doctors?.map(doc => (
            <Card key={doc.id} className="p-6 flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
              <div className="flex-1 grid md:grid-cols-2 gap-4 w-full">
                <div>
                  <h3 className="text-xl font-bold mb-1">{doc.name}</h3>
                  <div className="text-sm text-muted-foreground mb-2">{doc.email} • {doc.phone}</div>
                  <Badge variant={doc.nmcVerified ? 'success' : 'error'} className="mt-1">
                    {doc.nmcVerified ? 'NMC Verified' : 'NMC Match Failed'}
                  </Badge>
                </div>
                
                <div className="bg-secondary p-4 rounded-xl text-sm space-y-1">
                  <div className="flex justify-between border-b border-border/50 pb-1">
                    <span className="text-muted-foreground">Reg No:</span>
                    <span className="font-mono font-bold">{doc.registrationNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 py-1">
                    <span className="text-muted-foreground">Council:</span>
                    <span className="font-medium text-right max-w-[150px] truncate" title={doc.stateCouncil}>{doc.stateCouncil}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Year:</span>
                    <span className="font-medium">{doc.year}</span>
                  </div>
                </div>
              </div>

              <div className="flex w-full lg:w-auto gap-3 shrink-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-border">
                <Button 
                  variant="outline" 
                  className="flex-1 text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => handleAction(doc.id, 'reject')}
                  isLoading={rejectMut.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => handleAction(doc.id, 'approve')}
                  isLoading={approveMut.isPending}
                >
                  <ShieldAlert className="w-4 h-4 mr-2" /> Manual Approve
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
