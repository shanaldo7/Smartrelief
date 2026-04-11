"use client"

import { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, useUser } from "@/firebase";
import { collection, query, orderBy, serverTimestamp, doc } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Zap, AlertTriangle, Database, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string;
  location: string;
  urgency: "low" | "medium" | "high";
  priority: number;
  skillsRequired: string[];
  status: string;
  ownerId: string;
}

interface Volunteer {
  id: string;
  name: string;
  location: string;
  skills: string[];
}

interface Match {
  taskId: string;
  volunteerId: string;
  score: number;
  reasons: string[];
  taskTitle: string;
  volunteerName: string;
}

const SAMPLE_NGO_DATA = [
  { title: "Flood Shelter Support", description: "Assisting families with bedding and food supplies in flooded residential zones.", skillsRequired: ["General Labor", "Admin"], location: "Riverside", urgency: "high", priority: 3, status: "open", submittedBy: "Emergency Response NGO" },
  { title: "First Aid Station Assistance", description: "Looking for healthcare workers to assist at the mobile clinics.", skillsRequired: ["Healthcare"], location: "Downtown", urgency: "high", priority: 3, status: "open", submittedBy: "Red Cross" },
  { title: "Logistics Coordinator", description: "Coordinating truck arrivals and inventory of water supplies.", skillsRequired: ["Admin", "Tech Support"], location: "East Port", urgency: "medium", priority: 2, status: "open", submittedBy: "Food Bank" },
  { title: "Tech Support for Ops Center", description: "Maintaining internet and radio comms for rescue teams.", skillsRequired: ["Tech Support"], location: "Command Center", urgency: "medium", priority: 2, status: "open", submittedBy: "Response Corps" },
  { title: "Neighborhood Cleanup", description: "Clearing debris from local roads to allow emergency access.", skillsRequired: ["General Labor", "Driving"], location: "West Hills", urgency: "low", priority: 1, status: "open", submittedBy: "City Council" },
];

export default function Dashboard() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  // Memoized queries
  const tasksQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "tasks"), orderBy("priority", "desc"), orderBy("createdAt", "desc"));
  }, [db]);

  const volunteersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "volunteerProfiles"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: tasks = [] } = useCollection<Task>(tasksQuery);
  const { data: volunteers = [] } = useCollection<Volunteer>(volunteersQuery);

  // Calculate matches dynamically based on data
  const matches = useMemo(() => {
    if (!tasks || !volunteers) return [];
    
    const results: Match[] = [];
    tasks.filter(t => t.status === 'open').forEach(task => {
      volunteers.forEach(volunteer => {
        let score = 0;
        const reasons: string[] = [];

        // Skill Match
        const matchedSkills = task.skillsRequired.filter(skill => 
          volunteer.skills.some(vSkill => vSkill.toLowerCase() === skill.toLowerCase())
        );
        if (matchedSkills.length > 0) {
          score += matchedSkills.length * 15;
          reasons.push(`${matchedSkills.length} skills matched`);
        }

        // Location Match
        if (task.location.toLowerCase() === volunteer.location.toLowerCase()) {
          score += 25;
          reasons.push("Local volunteer");
        }

        if (score > 0) {
          results.push({
            taskId: task.id,
            volunteerId: volunteer.id,
            score: score + (task.priority * 10),
            reasons,
            taskTitle: task.title,
            volunteerName: volunteer.name
          });
        }
      });
    });

    return results.sort((a, b) => b.score - a.score);
  }, [tasks, volunteers]);

  const areaImpact = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks?.forEach(t => {
      counts[t.location] = (counts[t.location] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [tasks]);

  const handleImportData = async () => {
    if (!db || !user) {
      toast({ variant: "destructive", title: "Wait a moment", description: "We are initializing your session." });
      return;
    }
    setIsImporting(true);
    try {
      for (const item of SAMPLE_NGO_DATA) {
        const taskRef = doc(collection(db, "tasks"));
        setDocumentNonBlocking(taskRef, {
          ...item,
          id: taskRef.id,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      toast({
        title: "NGO Data Imported",
        description: `Successfully loaded ${SAMPLE_NGO_DATA.length} sample tasks into Firestore.`,
      });
    } catch (error) {
      // Errors handled by FirebaseErrorListener
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight font-headline text-foreground">Relief Command Center</h1>
            <p className="text-muted-foreground">Strategic overview of disaster impact and volunteer mobilization.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              className="bg-card shadow-sm gap-2"
              onClick={handleImportData}
              disabled={isImporting}
            >
              <Database className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import NGO Data"}
            </Button>
            <div className="flex h-10 items-center gap-4 bg-card px-4 rounded-xl shadow-sm border">
               <div className="flex items-center gap-1.5 border-r pr-4">
                 <Activity className="h-4 w-4 text-primary" />
                 <span className="text-sm font-bold">{(tasks || []).length}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold">Needs</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <Users className="h-4 w-4 text-accent" />
                 <span className="text-sm font-bold">{(volunteers || []).length}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold">Rescuers</span>
               </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
           <Card className="lg:col-span-1 shadow-sm border-none bg-primary/5">
             <CardHeader>
               <CardTitle className="text-sm font-bold flex items-center gap-2">
                 <AlertTriangle className="h-4 w-4 text-primary" />
                 Critical Areas
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 {areaImpact.length > 0 ? areaImpact.map(([area, count]) => (
                   <div key={area} className="flex justify-between items-center">
                     <span className="text-sm font-medium">{area}</span>
                     <Badge variant="secondary" className="font-mono">{count} tasks</Badge>
                   </div>
                 )) : (
                   <p className="text-xs text-muted-foreground">No area data available.</p>
                 )}
               </div>
             </CardContent>
           </Card>

           <div className="lg:col-span-3">
             <Tabs defaultValue="matches" className="space-y-8">
               <TabsList className="grid w-full grid-cols-3 max-w-md h-12 bg-muted p-1 rounded-xl">
                 <TabsTrigger value="matches" className="rounded-lg data-[state=active]:shadow-sm">Smart Matches</TabsTrigger>
                 <TabsTrigger value="tasks" className="rounded-lg data-[state=active]:shadow-sm">Urgent Needs</TabsTrigger>
                 <TabsTrigger value="volunteers" className="rounded-lg data-[state=active]:shadow-sm">Rescuers</TabsTrigger>
               </TabsList>

               <TabsContent value="matches" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {matches.length > 0 ? (
                     matches.map((match, i) => (
                       <Card key={`${match.taskId}-${match.volunteerId}`} className="relative border-none shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 bg-card group">
                         <div className="absolute top-0 right-0 p-4">
                           <div className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                             <Zap className="h-3 w-3" /> {match.score} Score
                           </div>
                         </div>
                         <CardHeader className="pb-2">
                           <CardTitle className="text-lg flex items-center gap-2 font-bold">
                             Recommendation
                           </CardTitle>
                           <CardDescription>Matching volunteer profile to NGO task</CardDescription>
                         </CardHeader>
                         <CardContent className="space-y-4">
                           <div className="p-3 bg-muted/30 rounded-xl">
                             <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Impact Goal</p>
                             <p className="font-bold text-foreground truncate">{match.taskTitle}</p>
                           </div>
                           <div className="p-3 bg-primary/5 rounded-xl border-l-4 border-primary">
                             <p className="text-[10px] font-bold text-primary uppercase mb-1">Assigned Candidate</p>
                             <p className="font-bold text-foreground">{match.volunteerName}</p>
                           </div>
                           <div className="flex flex-wrap gap-2 pt-2">
                             {match.reasons.map((r, idx) => (
                               <Badge key={idx} variant="outline" className="text-[10px] bg-white/50 border-primary/20">
                                 {r}
                               </Badge>
                             ))}
                           </div>
                         </CardContent>
                       </Card>
                     ))
                   ) : (
                     <div className="col-span-full py-32 text-center bg-card rounded-3xl border-2 border-dashed">
                       <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                       <h3 className="text-xl font-bold">No High-Confidence Matches</h3>
                       <p className="text-muted-foreground mt-1">Register more volunteers or tasks to see AI recommendations.</p>
                     </div>
                   )}
                 </div>
               </TabsContent>

               <TabsContent value="tasks" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {(tasks || []).map(task => (
                     <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-shadow bg-card">
                       <CardHeader className="pb-2">
                         <div className="flex justify-between items-start mb-3">
                           <Badge className={cn(
                             "text-[10px] uppercase font-bold px-2 py-0.5",
                             task.urgency === 'high' ? "bg-red-500 hover:bg-red-600" : 
                             task.urgency === 'medium' ? "bg-amber-500 hover:bg-amber-600" : 
                             "bg-emerald-500 hover:bg-emerald-600"
                           )}>
                             {task.urgency} Priority
                           </Badge>
                           <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
                             <MapPin className="h-3.5 w-3.5" /> {task.location}
                           </div>
                         </div>
                         <CardTitle className="text-xl font-bold font-headline leading-tight tracking-tight">{task.title}</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4 pt-2">
                         <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{task.description}</p>
                         <div className="flex flex-wrap gap-2">
                           {task.skillsRequired.map((skill, idx) => (
                             <Badge key={idx} variant="secondary" className="text-[10px] font-medium bg-muted text-muted-foreground border-none">
                               {skill}
                             </Badge>
                           ))}
                         </div>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
               </TabsContent>

               <TabsContent value="volunteers" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {(volunteers || []).map(volunteer => (
                     <Card key={volunteer.id} className="border-none shadow-sm bg-card">
                       <CardHeader className="pb-2">
                         <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-3">
                           <MapPin className="h-3.5 w-3.5 text-accent" /> {volunteer.location}
                         </div>
                         <CardTitle className="text-xl font-bold font-headline">{volunteer.name}</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-5 pt-2">
                         <div className="space-y-3">
                           <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">Qualified Expertise</p>
                           <div className="flex flex-wrap gap-2">
                             {volunteer.skills.map((skill, idx) => (
                               <Badge key={idx} className="bg-accent/10 text-accent hover:bg-accent/20 border-none font-semibold px-3 py-1">
                                 {skill}
                               </Badge>
                             ))}
                           </div>
                         </div>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
               </TabsContent>
             </Tabs>
           </div>
        </div>
      </main>
    </div>
  );
}
