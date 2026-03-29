import { Link } from "wouter";
import { Button, PageTransition } from "@/components/ui-elements";
import { HeartPulse, Shield, Video, Clock, ArrowRight, CheckCircle2, FileText } from "lucide-react";

export default function Landing() {
  return (
    <PageTransition className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <HeartPulse className="w-8 h-8" />
            <span className="font-display font-bold text-2xl tracking-tight">PharmaSense</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-foreground/80 hover:text-primary transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/register/patient">
              <Button size="sm" className="rounded-full">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 pt-20">
        <div className="relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 -z-10" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-32 lg:pb-40">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  NMC Verified Doctors Available Now
                </div>
                <h1 className="text-5xl lg:text-7xl font-display font-bold text-foreground leading-[1.1] mb-6">
                  Quality healthcare from the <span className="text-gradient">comfort of home.</span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl">
                  Connect with certified specialists instantly. Secure video consultations, digital prescriptions, and medication delivery right to your door.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/register/patient">
                    <Button size="lg" className="w-full sm:w-auto rounded-full group">
                      Find a Doctor
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/register/doctor">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full">
                      I'm a Doctor
                    </Button>
                  </Link>
                </div>
                
                <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    Secure Video Calls
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    Verified Specialists
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/20 aspect-[4/3] lg:aspect-square">
                  {/* landing page hero scenic mountain landscape */}
                  <img 
                    src={`${import.meta.env.BASE_URL}images/hero-medical.png`}
                    alt="Abstract medical background" 
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Floating Elements */}
                  <div className="absolute top-8 right-8 glass-panel p-4 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Video className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">Dr. Sarah Jenkins</div>
                      <div className="text-xs text-muted-foreground">Cardiologist • Online</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-secondary/20 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-display font-bold mb-4">Everything you need for your health</h2>
              <p className="text-muted-foreground text-lg">A complete ecosystem designed to make healthcare accessible, transparent, and efficient.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Shield, title: "NMC Verified Doctors", desc: "Every doctor undergoes automatic verification with the National Medical Commission." },
                { icon: Clock, title: "Instant Consultations", desc: "Find doctors who are online right now and connect within minutes." },
                { icon: FileText, title: "Digital Prescriptions", desc: "Receive prescriptions directly in the app and order medications with one click." }
              ].map((feature, i) => (
                <div key={i} className="bg-secondary/50 rounded-3xl p-8 border border-border hover:border-primary/20 transition-colors">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-foreground text-white py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white/60">
          <HeartPulse className="w-8 h-8 text-primary mx-auto mb-6" />
          <p>© 2025 PharmaSense. All rights reserved.</p>
        </div>
      </footer>
    </PageTransition>
  );
}
