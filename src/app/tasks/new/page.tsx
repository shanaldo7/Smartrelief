
"use client"

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Sparkles, MapPin, Navigation, Mail, Users, DollarSign, Calendar } from "lucide-react";
import { useFirestore, useUser, setDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { smartTaskDescriptionAssistant } from "@/ai/flows/smart-task-description-assistant";

const CATEGORIES = ["Food", "Medical", "Teaching", "Logistics", "Admin", "General Support"];

export default function NewTask() {
  const db = useFirestore();
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState("19.0760, 72.8777");
  const [urgency, setUrgency] = useState("medium");
  const [skillsRequired, setSkillsRequired] = useState("");
  
  // New Recruitment Fields
  const [isPaid, setIsPaid] = useState("false");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [requiredPeople, setRequiredPeople] = useState("1");
  const [startDate, setStartDate] = useState("");

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setIsLocating(false);
      },
      () => setIsLocating(false)
    );
  };

  const handleEnhance = async () => {
    if (!description.trim()) return;
    setIsEnhancing(true);
    try {
      const result = await smartTaskDescriptionAssistant({ taskDescription: description });
      setDescription(result.enhancedTaskDescription);
      toast({ title: "Briefing Optimized" });
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
      toast({ variant: "destructive", title: "Invalid GPS Data" });
      return;
    }

    setLoading(true);
    const priority = urgency === "high" ? 3 : urgency === "medium" ? 2 : 1;

    try {
      const taskRef = doc(collection(db, "tasks"));
      setDocumentNonBlocking(taskRef, {
        id: taskRef.id,
        title,
        contactEmail: email,
        description,
        category,
        location,
        latitude: lat,
        longitude: lng,
        urgency,
        priority,
        isPaid: isPaid === "true",
        paymentAmount: isPaid === "true" ? parseFloat(paymentAmount) : 0,
        requiredPeople: parseInt(requiredPeople),
        startTime: startDate || null,
        skillsRequired: skillsRequired.split(",").map(s => s.trim()).filter(s => s !== ""),
        status: "open",
        ownerId: user.uid,
        submittedBy: user.displayName || "NGO Partner",
        applicants: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const actRef = doc(collection(db, "activities"));
      setDocumentNonBlocking(actRef, {
        id: actRef.id,
        type: "new_task",
        message: `Strategic Broadcast: ${title} in ${location}`,
        timestamp: serverTimestamp()
      }, { merge: true });
      
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
              <ClipboardList className="h-6 w-6" />
              <span className="font-bold uppercase tracking-widest text-xs">Opportunity Broadcast</span>
            </div>
            <CardTitle className="text-3xl font-black font-headline uppercase leading-tight">Create Relief Mission</CardTitle>
            <CardDescription className="font-medium italic">Define workforce requirements to recruit local responders.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Mission Title</Label>
                  <Input placeholder="e.g. Flood Zone Medical Support" value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">NGO Contact Email</Label>
                  <Input type="email" placeholder="operations@ngo.org" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Engagement Type</Label>
                  <Select value={isPaid} onValueChange={setIsPaid}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Volunteer (Free)</SelectItem>
                      <SelectItem value="true">Professional (Paid)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Personnel Req.</Label>
                  <Input type="number" min="1" value={requiredPeople} onChange={e => setRequiredPeople(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Budget (if paid)</Label>
                  <Input type="number" placeholder="Amt" disabled={isPaid === "false"} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Deployment Start</Label>
                <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Briefing</Label>
                  <Button type="button" variant="ghost" size="sm" className="text-[10px] font-bold uppercase text-primary" onClick={handleEnhance} disabled={isEnhancing}>
                    <Sparkles className="h-3 w-3 mr-1" /> AI Optimize
                  </Button>
                </div>
                <Textarea placeholder="Mission objectives and required actions..." className="min-h-[100px]" value={description} onChange={e => setDescription(e.target.value)} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">Aid Sector</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground ml-1">GPS Coordinates</Label>
                  <div className="flex gap-2">
                    <Input className="font-mono text-xs" value={coords} onChange={e => setCoords(e.target.value)} required />
                    <Button type="button" variant="outline" size="icon" onClick={handleDetectLocation} disabled={isLocating}>
                      <Navigation className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-12 pt-4">
              <Button type="submit" className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl" disabled={loading}>
                {loading ? "Transmitting..." : "Broadcast Opportunity"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
