import { useGetAdminStats } from "@workspace/api-client-react";
import { PageTransition, Card } from "@/components/ui-elements";
import { Users, UserPlus, Activity, Video } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  const statCards = [
    { label: "Total Doctors", value: stats?.totalDoctors || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pending Verifications", value: stats?.pendingVerifications || 0, icon: UserPlus, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { label: "Total Patients", value: stats?.totalPatients || 0, icon: Activity, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Active Consults", value: stats?.activeConsultations || 0, icon: Video, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <PageTransition className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Platform statistics and overview.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="p-6 flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
                {isLoading ? (
                  <div className="h-8 w-16 bg-muted animate-pulse rounded mt-1" />
                ) : (
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      
      <Card className="p-8 mt-8 border-dashed flex flex-col items-center justify-center text-center text-muted-foreground">
         <Activity className="w-12 h-12 mb-4 opacity-20" />
         <p>Additional reporting and analytics features coming soon.</p>
      </Card>
    </PageTransition>
  );
}
