
"use client"

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Navigation, Mail, User } from "lucide-react";
import { useFirestore, useUser, setDocumentNonBlocking } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SKILLS = [
  "General Labor", "Healthcare", "Tech Support", "Cooking", "Driving", "Admin", "Logistics"
];

export default function NewVolunteer() {
  const db = useFirestore();
  const { user } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState("19.0760, 72.8777");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
    if (user?.displayName) {
      setName(user.displayName);
    }
  }, [user]);

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

    if (!name || !email || !location || selectedSkills.length === 0) {
      toast({ variant: "destructive", title: "Missing Details", description: "Please complete all profile sections." });
      return;
    }

    setLoading(true);
    try {
      const profileRef = doc(db, "volunteerProfiles", user.uid);
      setDocumentNonBlocking(profileRef, {
        id: user.uid,
        name,
        email: email,
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
        <Card className="shadow-2xl border-none rounded-3xl overflow-hidden bg-card">
          <CardHeader className="bg-primary/5 pb-8 border-b">
            <div className="flex items-center gap-2 text-primary mb-2">
              <ShieldCheck className="h-6 w-6" />
              <span className="font-bold uppercase tracking-widest text-xs">Responder Enrollment</span>
            </div>
            <CardTitle className="text-3xl font-black font-headline uppercase">Volunteer as a Rescuer</CardTitle>
            <CardDescription className="font-medium italic">Join the grid to receive real-time alerts for local humanitarian needs.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-8 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input id="name" placeholder="Legal Name" className="rounded-xl h-12 border-2 pl-10" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Contact Gmail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="email@gmail.com" className="rounded-xl h-12 border-2 pl-10" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="location" className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Base Operations City</Label>
                  <Input id="location" placeholder="e.g. Delhi" className="rounded-xl h-12 border-2" value={location} onChange={e => setLocation(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <Label htmlFor="coords" className="font-bold text-[10px] uppercase text-muted-foreground ml-1">GPS Location</Label>
                    <Button type="button" variant="link" size="sm" className="text-[10px] font-bold uppercase h-6 p-0 text-primary" onClick={handleDetectLocation} disabled={isLocating}>
                      <Navigation className="h-3 w-3 mr-1" /> Use GPS
                    </Button>
                  </div>
                  <Input id="coords" placeholder="lat, lng" className="rounded-xl h-12 font-mono text-xs border-2" value={coords} onChange={e => setCoords(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Support Expertise</Label>
                <div className="grid grid-cols-2 gap-3">
                  {SKILLS.map(skill => (
                    <div 
                      key={skill} 
                      className={cn(
                        "flex items-center space-x-3 border-2 rounded-2xl p-4 transition-all cursor-pointer hover:border-primary/50",
                        selectedSkills.includes(skill) ? "bg-primary/5 border-primary shadow-sm" : "bg-card"
                      )}
                      onClick={() => handleSkillToggle(skill)}
                    >
                      <Checkbox 
                        id={`skill-${skill}`} 
                        checked={selectedSkills.includes(skill)} 
                        className="rounded-full h-5 w-5 border-2 pointer-events-none"
                      />
                      <Label className="flex-grow cursor-pointer font-bold text-xs uppercase tracking-tight pointer-events-none">{skill}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-12 pt-4">
              <Button type="submit" className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl hover:shadow-2xl transition-all" disabled={loading}>
                {loading ? "Activating..." : "Broadcast Availability"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
