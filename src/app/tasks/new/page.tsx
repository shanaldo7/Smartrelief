"use client"

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Sparkles, AlertCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { smartTaskDescriptionAssistant } from "@/ai/flows/smart-task-description-assistant";

export default function NewTask() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
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
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to enhance description." });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !location || !skillsRequired) {
      toast({ variant: "destructive", title: "Missing fields", description: "Please fill in all details." });
      return;
    }

    setLoading(true);
    // Priority: high = 3, medium = 2, low = 1
    const priority = urgency === "high" ? 3 : urgency === "medium" ? 2 : 1;

    try {
      await addDoc(collection(db, "tasks"), {
        title,
        description,
        location,
        urgency,
        priority,
        skillsRequired: skillsRequired.split(",").map(s => s.trim()).filter(s => s !== ""),
        status: "open",
        createdAt: serverTimestamp()
      });
      toast({ title: "Success!", description: "Your task has been posted." });
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to post task." });
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
              <ClipboardList className="h-6 w-6" />
              <span className="font-semibold uppercase tracking-wider text-xs">Request Support</span>
            </div>
            <CardTitle className="text-3xl font-bold font-headline">Post a New Task</CardTitle>
            <CardDescription>
              Let our community know what you need. Be as specific as possible.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g. Community Garden Cleanup" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-8 text-accent hover:text-accent hover:bg-accent/10"
                    onClick={handleEnhance}
                    disabled={isEnhancing}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {isEnhancing ? "Enhancing..." : "Improve with AI"}
                  </Button>
                </div>
                <Textarea 
                  id="description" 
                  placeholder="Describe the task, its purpose, and what needs to be done..." 
                  className="min-h-[120px]"
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input 
                    id="location" 
                    placeholder="e.g. Green Park" 
                    value={location} 
                    onChange={e => setLocation(e.target.value)} 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency Level</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger id="urgency">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skills">Required Skills (comma separated)</Label>
                <Input 
                  id="skills" 
                  placeholder="e.g. Gardening, Heavy Lifting" 
                  value={skillsRequired} 
                  onChange={e => setSkillsRequired(e.target.value)} 
                  required
                />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Separate skills with commas for better matching.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-primary h-12 text-lg" disabled={loading}>
                {loading ? "Posting..." : "Post Task"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
