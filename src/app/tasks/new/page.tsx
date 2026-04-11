
"use client"

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Sparkles, AlertCircle, MapPin } from "lucide-react";
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
  const [lat, setLat] = useState("19.0760");
  const [lng, setLng] = useState("72.8777");
  const [urgency, setUrgency] = useState("medium");
  const [skillsRequired, setSkillsRequired] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEnhance = async () => {
    if (!description.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a description first." });
      return;
    }
    setIsEnhancing(true);
    try {
      const result = await smartTaskDescriptionAssistant({ taskDescription: description });
      setDescription(result.enhancedTaskDescription);
      toast({ title: "Enhanced!", description: "AI has updated your task description to be more engaging." });
    } catch (error) { } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!title || !description || !location || !lat || !lng) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all details." });
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
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="shadow-xl border-none">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 text-primary mb-2">
              <ClipboardList className="h-6 w-6" />
              <span className="font-semibold uppercase tracking-wider text-xs">Request Support</span>
            </div>
            <CardTitle className="text-3xl font-bold font-headline">Post a New Task</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input id="title" placeholder="e.g. Water Distribution Hub" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-accent" onClick={handleEnhance} disabled={isEnhancing}>
                    <Sparkles className="h-3 w-3 mr-1" /> {isEnhancing ? "Enhancing..." : "AI Improve"}
                  </Button>
                </div>
                <Textarea id="description" placeholder="What is needed..." className="min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Area Name</Label>
                  <Input id="location" placeholder="e.g. South Port" value={location} onChange={e => setLocation(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger><SelectValue placeholder="Urgency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input id="lat" type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input id="lng" type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skills">Required Skills (commas)</Label>
                <Input id="skills" placeholder="e.g. Healthcare, Driving" value={skillsRequired} onChange={e => setSkillsRequired(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
                {loading ? "Deploying..." : "Post to Command Center"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
