import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useRegisterPatient } from "@workspace/api-client-react";
import { Button, Input, Card, PageTransition } from "@/components/ui-elements";
import { HeartPulse } from "lucide-react";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPatient() {
  const [, setLocation] = useLocation();
  const { refreshAuth } = useAuth();
  
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const registerMutation = useRegisterPatient();

  const onSubmit = (data: FormValues) => {
    registerMutation.mutate({ data }, {
      onSuccess: () => {
        refreshAuth();
        setLocation('/patient/dashboard');
      },
      onError: (err: any) => {
        form.setError("root", { message: err?.message || "Registration failed" });
      }
    });
  };

  return (
    <PageTransition className="min-h-screen bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <HeartPulse className="w-10 h-10 text-primary" />
        </Link>
        <h2 className="text-center text-3xl font-display font-bold text-foreground">Create Patient Account</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card className="p-8">
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            {form.formState.errors.root && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
                {form.formState.errors.root.message}
              </div>
            )}

            <Input label="Full Name" placeholder="John Doe" {...form.register("name")} error={form.formState.errors.name?.message} />
            <Input label="Email" type="email" placeholder="john@example.com" {...form.register("email")} error={form.formState.errors.email?.message} />
            <Input label="Phone Number" type="tel" placeholder="+1 234 567 890" {...form.register("phone")} error={form.formState.errors.phone?.message} />
            <Input label="Password" type="password" placeholder="••••••••" {...form.register("password")} error={form.formState.errors.password?.message} />

            <Button type="submit" className="w-full mt-2" isLoading={registerMutation.isPending}>
              Create Account
            </Button>
          </form>
          
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
          </p>
        </Card>
      </div>
    </PageTransition>
  );
}
