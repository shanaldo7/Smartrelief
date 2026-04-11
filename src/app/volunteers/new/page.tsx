"use client"

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { useFirestore, useUser, setDocumentNonBlocking } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const SKILLS = [
  "General Labor", "Teaching", "Healthcare", "Tech Support", "Cooking", "Driving", "Gardening", "Cleaning", "Admin"
];

export default function NewVolunteer() {
  const db = useFirestore();
  const { user } = useUser();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSkillToggle = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) {
      toast({ variant: "destructive", title: "Wait a moment", description: "Your session is initializing." });
      return;
    }
    if (!name || !location || selectedSkills.length === 0) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all details." });
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
        skills: selectedSkills,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Success!", description: "Your volunteer profile has been created." });
      router.push("/dashboard");
    } catch (error) {
      // Error handled by FirebaseErrorListener
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="shadow-xl border-none">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 text-primary mb-2">
              <UserPlus className="h-6 w-6" />
              <span className="font-semibold uppercase tracking-wider text-xs">Join our mission</span>
            </div>
            <CardTitle className="text-3xl font-bold font-headline">Volunteer Profile</CardTitle>
            <CardDescription>
              Tell us a bit about yourself and what you can offer. We'll match you with the right opportunities.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="Enter your name" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Your Location (City/Neighborhood)</Label>
                <Input 
                  id="location" 
                  placeholder="e.g. Downtown, Brooklyn" 
                  value={location} 
                  onChange={e => setLocation(e.target.value)} 
                  required
                />
              </div>
              <div className="space-y-3">
                <Label>Your Key Skills</Label>
                <div className="grid grid-cols-2 gap-3">
                  {SKILLS.map(skill => (
                    <div key={skill} className="flex items-center space-x-2 border rounded-lg p-2 hover:bg-muted transition-colors cursor-pointer">
                      <Checkbox 
                        id={`skill-${skill}`} 
                        checked={selectedSkills.includes(skill)}
                        onCheckedChange={() => handleSkillToggle(skill)}
                      />
                      <Label htmlFor={`skill-${skill}`} className="flex-grow cursor-pointer">{skill}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-primary h-12 text-lg" disabled={loading}>
                {loading ? "Saving..." : "Create Profile"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
