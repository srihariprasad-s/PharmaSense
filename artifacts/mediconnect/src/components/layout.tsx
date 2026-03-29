import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { 
  HeartPulse, LayoutDashboard, Calendar, FileText, 
  Settings, LogOut, Search, Users, Activity, Bell, Menu, X, FlaskConical,
} from "lucide-react";
import { useState } from "react";
import { cn } from "./ui-elements";

export function AppLayout({ children }: { children: ReactNode }) {
  const { role, user, refreshAuth } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const logout = useLogout();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        refreshAuth();
        setLocation("/");
      }
    });
  };

  const navItems = {
    patient: [
      { label: "Dashboard", href: "/patient/dashboard", icon: LayoutDashboard },
      { label: "Find Doctors", href: "/patient/doctors", icon: Search },
      { label: "Appointments", href: "/patient/appointments", icon: Calendar },
      { label: "My Records", href: "/patient/records", icon: FileText },
      { label: "Rx Analyser", href: "/patient/rx-analysis", icon: FlaskConical },
    ],
    doctor: [
      { label: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
      { label: "Appointments", href: "/doctor/appointments", icon: Calendar },
      { label: "Patient Records", href: "/doctor/patients", icon: Users },
      { label: "My Profile", href: "/doctor/profile", icon: Settings },
    ],
    admin: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Verifications", href: "/admin/doctors", icon: Users },
    ]
  };

  const links = role ? navItems[role] : [];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <HeartPulse className="w-6 h-6" />
          <span className="font-display font-bold text-lg">PharmaSense</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-foreground">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 items-center gap-3 hidden md:flex">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
            <HeartPulse className="w-6 h-6" />
          </div>
          <span className="font-display font-bold text-xl text-foreground">PharmaSense</span>
        </div>

        <div className="px-4 py-6 md:py-2 flex-1 flex flex-col gap-1 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">Menu</div>
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || location.startsWith(link.href + '/');
            return (
              <Link 
                key={link.href} 
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl bg-secondary/60">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex flex-col flex-1 overflow-hidden">
              <span className="text-sm font-bold text-foreground truncate">{user?.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{role}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-full overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden md:flex h-16 bg-card/60 backdrop-blur-md border-b border-border items-center justify-between px-8 sticky top-0 z-30">
          <div className="text-sm font-medium text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.charAt(0) || "U"}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-background">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
