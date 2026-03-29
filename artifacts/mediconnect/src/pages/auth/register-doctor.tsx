import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useRegisterDoctor } from "@workspace/api-client-react";
import { Button, Input, Card, PageTransition } from "@/components/ui-elements";
import { HeartPulse, CheckCircle2, AlertCircle, Loader2, Shield, ShieldCheck, ShieldX } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(10, "Phone is required"),
  registrationNumber: z.string().min(3, "Registration number required"),
  fatherName: z.string().min(2, "Father's name required"),
  year: z.string().min(4, "Year of registration required"),
  stateCouncil: z.string().min(2, "State Medical Council required"),
});

type FormValues = z.infer<typeof schema>;

type NMCStatus = "idle" | "loading" | "found" | "not_found" | "error";
type NMCData = { name: string; fatherName: string; year: number; stateCouncil: string; registrationNumber: string };

export default function RegisterDoctor() {
  const [successResult, setSuccessResult] = useState<any>(null);
  const [nmcStatus, setNmcStatus] = useState<NMCStatus>("idle");
  const [nmcData, setNmcData] = useState<NMCData | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const registerMutation = useRegisterDoctor();

  const regNo = form.watch("registrationNumber");

  useEffect(() => {
    const val = regNo?.trim();
    if (!val || val.length < 4) {
      setNmcStatus("idle");
      setNmcData(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setNmcStatus("loading");
      setNmcData(null);
      try {
        const res = await fetch(`${BASE_URL}/api/auth/nmc-lookup?regNo=${encodeURIComponent(val)}`);
        if (res.status === 404) {
          setNmcStatus("not_found");
          return;
        }
        if (res.status === 503) {
          setNmcStatus("error");
          return;
        }
        if (!res.ok) {
          setNmcStatus("error");
          return;
        }
        const data: NMCData = await res.json();
        setNmcData(data);
        setNmcStatus("found");
        // Auto-fill fields
        form.setValue("name", data.name, { shouldValidate: true });
        form.setValue("fatherName", data.fatherName, { shouldValidate: true });
        form.setValue("year", data.year.toString(), { shouldValidate: true });
        form.setValue("stateCouncil", data.stateCouncil, { shouldValidate: true });
      } catch {
        setNmcStatus("error");
      }
    }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [regNo]);

  const onSubmit = (data: FormValues) => {
    registerMutation.mutate({ data }, {
      onSuccess: (res) => setSuccessResult(res),
      onError: (err: any) => form.setError("root", { message: err?.message || "Registration failed" }),
    });
  };

  if (successResult) {
    const isVerified = successResult.nmcVerified;
    const wasUnreachable = successResult.nmcUnreachable;

    return (
      <PageTransition className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          {isVerified ? (
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8" />
            </div>
          ) : wasUnreachable ? (
            <div className="w-16 h-16 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
          )}
          <h2 className="text-2xl font-bold mb-2">Registration Complete</h2>
          <p className="text-muted-foreground mb-6">{successResult.message}</p>
          {wasUnreachable && !isVerified && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-left mb-6">
              <p className="text-sm text-orange-400 font-semibold">What to do next:</p>
              <p className="text-sm text-orange-400/80 mt-1">Log in and go to your dashboard — there you'll find a <strong>"Retry NMC Verification"</strong> button. Once the NMC server is back online, tap it to get instantly verified.</p>
            </div>
          )}
          <div className="p-4 bg-secondary rounded-xl text-left mb-8">
            <div className="text-sm font-medium">Status: <span className={`font-bold uppercase ${isVerified ? "text-green-400" : "text-yellow-400"}`}>{successResult.verificationStatus}</span></div>
          </div>
          <Link href="/login"><Button className="w-full">Go to Login</Button></Link>
        </Card>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="text-center mb-8">
          <HeartPulse className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-display font-bold text-foreground">Doctor Registration</h2>
          <p className="mt-2 text-muted-foreground">Verified live against the National Medical Commission register</p>
        </div>

        <Card className="p-8">
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            {form.formState.errors.root && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {form.formState.errors.root.message}
              </div>
            )}

            {/* NMC Registration Number — live verify */}
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-2">
                NMC Registration Number <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <input
                  {...form.register("registrationNumber")}
                  placeholder="e.g. 146631"
                  className="flex h-12 w-full rounded-xl border border-border bg-secondary text-foreground px-4 py-2 text-lg font-semibold tracking-widest placeholder:text-muted-foreground placeholder:font-normal placeholder:tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all duration-200"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {nmcStatus === "loading" && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                  {nmcStatus === "found" && <ShieldCheck className="w-5 h-5 text-green-400" />}
                  {nmcStatus === "not_found" && <ShieldX className="w-5 h-5 text-yellow-400" />}
                  {nmcStatus === "idle" && <Shield className="w-5 h-5 text-muted-foreground" />}
                </div>
              </div>
              {form.formState.errors.registrationNumber && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.registrationNumber.message}</p>
              )}

              {/* NMC Status Banner */}
              {nmcStatus === "loading" && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Querying National Medical Commission register…</span>
                </div>
              )}
              {nmcStatus === "found" && nmcData && (
                <div className="mt-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-3">
                    <ShieldCheck className="w-4 h-4" /> NMC Verified — Details auto-filled below
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-semibold text-foreground">{nmcData.name}</span></div>
                    <div><span className="text-muted-foreground">Father:</span> <span className="font-semibold text-foreground">{nmcData.fatherName}</span></div>
                    <div><span className="text-muted-foreground">Year:</span> <span className="font-semibold text-foreground">{nmcData.year}</span></div>
                    <div><span className="text-muted-foreground">Council:</span> <span className="font-semibold text-foreground">{nmcData.stateCouncil}</span></div>
                  </div>
                </div>
              )}
              {nmcStatus === "not_found" && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Not found in NMC register</div>
                    <div className="text-xs mt-0.5 text-yellow-400/80">You can still register — your application will be sent for manual review by an admin.</div>
                  </div>
                </div>
              )}
              {nmcStatus === "error" && (
                <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  NMC server temporarily unreachable. You can still submit — verification will run on the server.
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-base border-b border-border pb-2">Account Details</h3>
                <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
                <Input label="Phone Number" type="tel" {...form.register("phone")} error={form.formState.errors.phone?.message} />
                <Input label="Password" type="password" {...form.register("password")} error={form.formState.errors.password?.message} />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-base border-b border-border pb-2 flex items-center gap-2">
                  NMC Details
                  {nmcStatus === "found" && <span className="text-xs text-green-400 font-normal">✦ Auto-filled</span>}
                </h3>
                <div className="relative">
                  <Input
                    label="Full Name (as in NMC records)"
                    {...form.register("name")}
                    error={form.formState.errors.name?.message}
                    readOnly={nmcStatus === "found"}
                    className={nmcStatus === "found" ? "border-green-500/40 bg-green-500/5 text-green-300" : ""}
                  />
                  {nmcStatus === "found" && <span className="absolute right-3 top-9 text-[10px] text-green-400 font-semibold">NMC ✦</span>}
                </div>
                <div className="relative">
                  <Input
                    label="Father's Name"
                    {...form.register("fatherName")}
                    error={form.formState.errors.fatherName?.message}
                    readOnly={nmcStatus === "found"}
                    className={nmcStatus === "found" ? "border-green-500/40 bg-green-500/5 text-green-300" : ""}
                  />
                  {nmcStatus === "found" && <span className="absolute right-3 top-9 text-[10px] text-green-400 font-semibold">NMC ✦</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Input
                      label="Year of Reg."
                      placeholder="YYYY"
                      {...form.register("year")}
                      error={form.formState.errors.year?.message}
                      readOnly={nmcStatus === "found"}
                      className={nmcStatus === "found" ? "border-green-500/40 bg-green-500/5 text-green-300" : ""}
                    />
                  </div>
                  <div className="relative">
                    <Input
                      label="State Council"
                      placeholder="e.g. Tamil Nadu Medical Council"
                      {...form.register("stateCouncil")}
                      error={form.formState.errors.stateCouncil?.message}
                      readOnly={nmcStatus === "found"}
                      className={nmcStatus === "found" ? "border-green-500/40 bg-green-500/5 text-green-300" : ""}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className={`w-full mt-2 ${nmcStatus === "found" ? "bg-green-600 hover:bg-green-700" : ""}`}
              size="lg"
              isLoading={registerMutation.isPending}
            >
              {nmcStatus === "found" ? (
                <><ShieldCheck className="w-4 h-4 mr-2" /> Register as NMC-Verified Doctor</>
              ) : (
                "Register & Verify with NMC"
              )}
            </Button>

            {registerMutation.isPending && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>
                  Verifying your registration with the National Medical Commission — this can take up to 60 seconds on the government server. Please keep this page open.
                </span>
              </div>
            )}
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
          </p>
        </Card>
      </div>
    </PageTransition>
  );
}
