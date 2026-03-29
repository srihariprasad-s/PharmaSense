import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, ProtectedRoute } from "@/lib/auth";
import { AppLayout } from "@/components/layout";

import Landing from "@/pages/landing";
import Login from "@/pages/auth/login";
import RegisterPatient from "@/pages/auth/register-patient";
import RegisterDoctor from "@/pages/auth/register-doctor";

import PatientDashboard from "@/pages/patient/dashboard";
import PatientSearch from "@/pages/patient/search";
import DoctorProfileView from "@/pages/patient/doctor-profile";
import PatientRecords from "@/pages/patient/records";
import PatientAppointments from "@/pages/patient/appointments";
import RxAnalysis from "@/pages/patient/rx-analysis";

import DoctorDashboard from "@/pages/doctor/dashboard";
import EditDoctorProfile from "@/pages/doctor/profile";
import DoctorPatients from "@/pages/doctor/patients";
import DoctorAppointments from "@/pages/doctor/appointments";

import ConsultationRoom from "@/pages/shared/consultation-room";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminDoctors from "@/pages/admin/doctors";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register/patient" component={RegisterPatient} />
      <Route path="/register/doctor" component={RegisterDoctor} />

      {/* Patient Routes */}
      <Route path="/patient/dashboard">
        <ProtectedRoute allowedRoles={['patient']}>
          <AppLayout><PatientDashboard /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/patient/doctors">
        <ProtectedRoute allowedRoles={['patient']}>
          <AppLayout><PatientSearch /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/patient/doctor/:id">
        <ProtectedRoute allowedRoles={['patient']}>
          <AppLayout><DoctorProfileView /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/patient/records">
        <ProtectedRoute allowedRoles={['patient']}>
          <AppLayout><PatientRecords /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/patient/appointments">
        <ProtectedRoute allowedRoles={['patient']}>
          <AppLayout><PatientAppointments /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/patient/rx-analysis">
        <ProtectedRoute allowedRoles={['patient']}>
          <AppLayout><RxAnalysis /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/patient/consultation/:id">
        <ProtectedRoute allowedRoles={['patient']}>
          <AppLayout><ConsultationRoom /></AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Doctor Routes */}
      <Route path="/doctor/dashboard">
        <ProtectedRoute allowedRoles={['doctor']}>
          <AppLayout><DoctorDashboard /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/doctor/profile">
        <ProtectedRoute allowedRoles={['doctor']}>
          <AppLayout><EditDoctorProfile /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/doctor/patients">
        <ProtectedRoute allowedRoles={['doctor']}>
          <AppLayout><DoctorPatients /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/doctor/appointments">
        <ProtectedRoute allowedRoles={['doctor']}>
          <AppLayout><DoctorAppointments /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/doctor/consultation/:id">
        <ProtectedRoute allowedRoles={['doctor']}>
          <AppLayout><ConsultationRoom /></AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute allowedRoles={['admin']}>
          <AppLayout><AdminDashboard /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/doctors">
        <ProtectedRoute allowedRoles={['admin']}>
          <AppLayout><AdminDoctors /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
