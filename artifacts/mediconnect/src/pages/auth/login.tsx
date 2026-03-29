import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button, Input, Card, PageTransition } from "@/components/ui-elements";
import { HeartPulse, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { refreshAuth } = useAuth();
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useLogin();

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        refreshAuth();
        // Redirect based on role
        if (res.role === 'admin') setLocation('/admin');
        else if (res.role === 'doctor') setLocation('/doctor/dashboard');
        else setLocation('/patient/dashboard');
      },
      onError: (err: any) => {
        // Handle error via form or toast
        form.setError("root", { message: err?.message || "Invalid email or password" });
      }
    });
  };

  return (
    <PageTransition className="min-h-screen bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 hover:opacity-80 transition-opacity">
          <HeartPulse className="w-10 h-10 text-primary" />
          <span className="font-display font-bold text-3xl">PharmaSense</span>
        </Link>
        <h2 className="text-center text-3xl font-display font-bold tracking-tight text-foreground">
          Welcome back
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="p-8 shadow-xl shadow-black/5">
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            
            {form.formState.errors.root && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center">
                {form.formState.errors.root.message}
              </div>
            )}

            <Input 
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              {...form.register("email")}
              error={form.formState.errors.email?.message}
            />

            <Input 
              label="Password"
              type="password"
              placeholder="••••••••"
              {...form.register("password")}
              error={form.formState.errors.password?.message}
            />

            <Button type="submit" className="w-full" isLoading={loginMutation.isPending}>
              Sign In
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <div className="mt-2 flex justify-center gap-4">
              <Link href="/register/patient" className="font-semibold text-primary hover:underline">
                Patient Sign up
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link href="/register/doctor" className="font-semibold text-primary hover:underline">
                Doctor Sign up
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
