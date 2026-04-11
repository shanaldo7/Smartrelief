
"use client"

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, MapPin, Navigation, ShieldCheck } from "lucide-react";
import { useFirestore, useUser, setDocumentNonBlocking } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const SKILLS = [
  "General Labor", "Healthcare", "Tech Support", "Cooking", "Driving", "Admin", "Logistics"
];

export default function NewVolunteer() {
  const db = useFirestore();
  const { user } = useUser();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState("19.0760, 72.8777");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Unsupported", description: "Geolocation not supported." });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setIsLocating(false);
        toast({ title: "Position Captured", description: "GPS coordinates synced." });
      },
      () => {
        setIsLocating(false);
        toast({ variant: "destructive", title: "Error", description: "Failed to capture GPS data." });
      }
    );
  };

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    const [latStr, lngStr] = coords.split(",").map(s => s.trim());
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      toast({ variant: "destructive", title: "Invalid GPS Data", description: "Format: lat, lng (e.g. 19.0760, 72.8777)." });
      return;
    }

    if (!name || !location || selectedSkills.length === 0) {
      toast({ variant: "destructive", title: "Missing Details", description: "Please complete all profile sections." });
      return;
    }

    setLoading(true);
    try {
      const profileRef = doc(db, "volunteerProfiles", user.uid);
      setDocumentNonBlocking(profileRef, {
        id: user.uid,
        name,
        email: user.email || "",
        location,
        latitude: lat,
        longitude: lng,
        skills: selectedSkills,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Profile Activated", description: "You are now visible as a responder on the tactical map." });
      router.push("/dashboard");
    } catch (error) { } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="shadow-2xl border-none rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <div className="flex items-center gap-2 text-primary mb-2">
              <ShieldCheck className="h-6 w-6" />
              <span className="font-bold uppercase tracking-widest text-xs">Responder Enrollment</span>
            </div>
            <CardTitle className="text-3xl font-extrabold font-headline">Volunteer as a Rescuer</CardTitle>
            <CardDescription>Join the grid to receive real-time alerts for local humanitarian needs.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-8 pt-8">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-bold text-xs uppercase text-muted-foreground">Full Legal Name</Label>
                <Input id="name" placeholder="How should NGOs address you?" className="rounded-xl h-12" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="location" className="font-bold text-xs uppercase text-muted-foreground">Base Operations City</Label>
                  <Input id="location" placeholder="e.g. Delhi" className="rounded-xl h-12" value={location} onChange={e => setLocation(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label htmlFor="coords" className="font-bold text-xs uppercase text-muted-foreground">GPS Location</Label>
                    <Button type="button" variant="link" size="sm" className="text-[10px] font-bold uppercase h-6 p-0" onClick={handleDetectLocation} disabled={isLocating}>
                      <Navigation className="h-3 w-3 mr-1" /> Use GPS
                    </Button>
                  </div>
                  <Input id="coords" placeholder="lat, lng" className="rounded-xl h-12 font-mono text-xs" value={coords} onChange={e => setCoords(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="font-bold text-xs uppercase text-muted-foreground">Combat / Support Expertise</Label>
                <div className="grid grid-cols-2 gap-3">
                  {SKILLS.map(skill => (
                    <div 
                      key={skill} 
                      className={cn(
                        "flex items-center space-x-3 border rounded-2xl p-4 transition-all cursor-pointer hover:border-primary/50",
                        selectedSkills.includes(skill) ? "bg-primary/5 border-primary shadow-sm" : "bg-card"
                      )}
                      onClick={() => handleSkillToggle(skill)}
                    >
                      <Checkbox 
                        id={`skill-${skill}`} 
                        checked={selectedSkills.includes(skill)} 
                        onCheckedChange={() => handleSkillToggle(skill)} 
                        className="rounded-full h-5 w-5"
                      />
                      <Label htmlFor={`skill-${skill}`} className="flex-grow cursor-pointer font-semibold text-sm">{skill}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl" disabled={loading}>
                {loading ? "Activating..." : "Broadcast Availability"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
