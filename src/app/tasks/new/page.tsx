
"use client"

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Sparkles, AlertCircle, MapPin, Navigation } from "lucide-react";
import { useFirestore, useUser, setDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { smartTaskDescriptionAssistant } from "@/ai/flows/smart-task-description-assistant";

export default function NewTask() {
  const db = useFirestore();
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState("19.0760, 72.8777");
  const [urgency, setUrgency] = useState("medium");
  const [skillsRequired, setSkillsRequired] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [loading, setLoading] = useState(false);
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
        toast({ title: "Location Detected", description: "Coordinates updated automatically." });
      },
      () => {
        setIsLocating(false);
        toast({ variant: "destructive", title: "Error", description: "Could not detect location." });
      }
    );
  };

  const handleEnhance = async () => {
    if (!description.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a description first." });
      return;
    }
    setIsEnhancing(true);
    try {
      const result = await smartTaskDescriptionAssistant({ taskDescription: description });
      setDescription(result.enhancedTaskDescription);
      toast({ title: "Enhanced!", description: "AI has updated your task description." });
    } catch (error) { } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    const [latStr, lngStr] = coords.split(",").map(s => s.trim());
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      toast({ variant: "destructive", title: "Invalid Coordinates", description: "Please enter valid lat, lng (e.g. 19.0760, 72.8777)." });
      return;
    }

    setLoading(true);
    const priority = urgency === "high" ? 3 : urgency === "medium" ? 2 : 1;

    try {
      const taskRef = doc(collection(db, "tasks"));
      setDocumentNonBlocking(taskRef, {
        id: taskRef.id,
        title,
        description,
        location,
        latitude: lat,
        longitude: lng,
        urgency,
        priority,
        skillsRequired: skillsRequired.split(",").map(s => s.trim()).filter(s => s !== ""),
        status: "open",
        ownerId: user.uid,
        submittedBy: user.displayName || "NGO Partner",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      toast({ title: "Success!", description: "Task pinned to operational map." });
      router.push("/dashboard");
    } catch (error) { } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="shadow-xl border-none rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <div className="flex items-center gap-2 text-primary mb-2">
              <ClipboardList className="h-6 w-6" />
              <span className="font-bold uppercase tracking-widest text-xs">Tactical Request</span>
            </div>
            <CardTitle className="text-3xl font-extrabold font-headline">New Relief Mission</CardTitle>
            <CardDescription>Specify the incident details to mobilize nearby rescuers.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-8">
              <div className="space-y-2">
                <Label htmlFor="title" className="font-bold text-xs uppercase text-muted-foreground">Mission Title</Label>
                <Input id="title" placeholder="e.g. Emergency Medical Supplies" className="rounded-xl h-12" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="description" className="font-bold text-xs uppercase text-muted-foreground">Tactical Briefing</Label>
                  <Button type="button" variant="ghost" size="sm" className="text-[10px] font-bold uppercase text-primary h-7" onClick={handleEnhance} disabled={isEnhancing}>
                    <Sparkles className="h-3 w-3 mr-1" /> {isEnhancing ? "Optimizing..." : "AI Enhance"}
                  </Button>
                </div>
                <Textarea id="description" placeholder="Describe the crisis and help required..." className="min-h-[120px] rounded-xl" value={description} onChange={e => setDescription(e.target.value)} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location" className="font-bold text-xs uppercase text-muted-foreground">City / Region</Label>
                  <Input id="location" placeholder="e.g. Mumbai" className="rounded-xl h-12" value={location} onChange={e => setLocation(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="urgency" className="font-bold text-xs uppercase text-muted-foreground">Priority Level</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Urgency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Impact</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">Critical / High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="coords" className="font-bold text-xs uppercase text-muted-foreground">GPS Coordinates (Lat, Lng)</Label>
                  <Button type="button" variant="outline" size="sm" className="text-[10px] font-bold uppercase h-7 rounded-lg" onClick={handleDetectLocation} disabled={isLocating}>
                    <Navigation className="h-3 w-3 mr-1" /> Detect
                  </Button>
                </div>
                <Input id="coords" placeholder="e.g. 19.0760, 72.8777" className="rounded-xl h-12 font-mono text-xs" value={coords} onChange={e => setCoords(e.target.value)} required />
                <p className="text-[10px] text-muted-foreground italic">Tip: Copy coordinates from any map app and paste here.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills" className="font-bold text-xs uppercase text-muted-foreground">Required Expertise (Comma Separated)</Label>
                <Input id="skills" placeholder="e.g. Healthcare, Logistics, Driving" className="rounded-xl h-12" value={skillsRequired} onChange={e => setSkillsRequired(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter className="pb-8">
              <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" disabled={loading}>
                {loading ? "Mobilizing..." : "Publish to Relief Map"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
