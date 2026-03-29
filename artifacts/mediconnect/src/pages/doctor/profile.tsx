import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { useGetDoctorById, useUpdateDoctorProfile } from "@workspace/api-client-react";
import { PageTransition, Card, Button, Input } from "@/components/ui-elements";
import { useToast } from "@/hooks/use-toast";
import { SPECIALTIES } from "@/lib/specialties";

export default function EditDoctorProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Doctor ID comes from me response
  const doctorId = user.doctorId;
  const { data: profile, isLoading } = useGetDoctorById(doctorId, { query: { enabled: !!doctorId } });
  const updateMutation = useUpdateDoctorProfile();

  const form = useForm({
    defaultValues: {
      specialty: "",
      subSpecialty: "",
      experience: 0,
      consultationFee: 50,
      bio: "",
      education: "",
      languages: "English",
      regions: ""
    }
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        specialty: profile.specialty || "",
        subSpecialty: profile.subSpecialty || "",
        experience: profile.experience || 0,
        consultationFee: profile.consultationFee || 50,
        bio: profile.bio || "",
        education: profile.education || "",
        languages: profile.languages?.join(", ") || "",
        regions: profile.regions?.join(", ") || ""
      });
    }
  }, [profile, form]);

  const onSubmit = (data: any) => {
    updateMutation.mutate({
      data: {
        ...data,
        experience: Number(data.experience),
        consultationFee: Number(data.consultationFee),
        languages: data.languages.split(",").map((s: string) => s.trim()).filter(Boolean),
        regions: data.regions.split(",").map((s: string) => s.trim()).filter(Boolean),
      }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Profile updated successfully" });
      }
    });
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <PageTransition className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Edit Profile</h1>
        <p className="text-muted-foreground mt-1">Make sure your profile is complete so patients can find you.</p>
      </div>

      <Card className="p-8">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Specialty</label>
              <select {...form.register("specialty")} className="w-full h-12 rounded-xl border border-border px-4 focus:ring-2 focus:ring-primary outline-none">
                <option value="">Select specialty…</option>
                {SPECIALTIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Input label="Sub-Specialty" placeholder="e.g. Heart Rhythm" {...form.register("subSpecialty")} />
            
            <Input label="Years of Experience" type="number" {...form.register("experience")} />
            <Input label="Consultation Fee ($)" type="number" {...form.register("consultationFee")} />
            
            <Input label="Languages (comma separated)" placeholder="English, Spanish" {...form.register("languages")} />
            <Input label="Regions/Cities (comma separated)" placeholder="New York, Online" {...form.register("regions")} />
          </div>

          <Input label="Education" placeholder="MBBS, MD - University Name" {...form.register("education")} />
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Professional Bio</label>
            <textarea 
              {...form.register("bio")}
              className="w-full rounded-xl border border-border p-4 focus:ring-2 focus:ring-primary outline-none resize-none h-32"
              placeholder="Tell patients about your experience and approach..."
            />
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button type="submit" size="lg" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </PageTransition>
  );
}
