"use client"

import { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Zap, AlertTriangle, Database, Activity, Loader2, BarChart3, Map as MapIcon, CheckCircle, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

// Dynamically import map to avoid SSR issues with Leaflet
const InteractiveMap = dynamic(() => import("@/components/Map"), { 
  ssr: false,
  loading: () => <div className="h-[450px] w-full bg-muted animate-pulse rounded-xl flex items-center justify-center text-muted-foreground border border-dashed font-bold uppercase tracking-widest">Initializing Map Engine...</div>
});

interface Task {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  urgency: "low" | "medium" | "high";
  priority: number;
  skillsRequired: string[];
  status: string;
  ownerId: string;
  submittedBy: string;
  createdAt?: any;
}

interface Volunteer {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  skills: string[];
  createdAt?: any;
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
  { title: "Food Distribution", description: "Providing meals to families in need.", skillsRequired: ["General Labor", "Logistics"], location: "Kolkata", latitude: 22.5726, longitude: 88.3639, urgency: "high", priority: 3, status: "open", submittedBy: "Food Relief NGO" },
  { title: "Medical Support", description: "Assisting at a local health clinic.", skillsRequired: ["Healthcare"], location: "Delhi", latitude: 28.6139, longitude: 77.2090, urgency: "medium", priority: 2, status: "open", submittedBy: "Medical Corps" },
  { title: "Remote Teaching", description: "Educational support for local children.", skillsRequired: ["Admin", "Tech Support"], location: "Mumbai", latitude: 19.0760, longitude: 72.8777, urgency: "low", priority: 1, status: "open", submittedBy: "EduHelp" },
  { title: "Emergency Logistics", description: "Coordinating resource arrival at regional hubs.", skillsRequired: ["Logistics", "Admin"], location: "Bangalore", latitude: 12.9716, longitude: 77.5946, urgency: "high", priority: 3, status: "open", submittedBy: "Logistics First" },
];

const chartConfig = {
  tasks: {
    label: "Active Needs",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function Dashboard() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);

  const tasksQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, "tasks");
  }, [db, user, isUserLoading]);

  const volunteersQuery = useMemoFirebase(() => {
    if (!db || !user || isUserLoading) return null;
    return collection(db, "volunteerProfiles");
  }, [db, user, isUserLoading]);

  const { data: rawTasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);
  const { data: rawVolunteers, isLoading: volunteersLoading } = useCollection<Volunteer>(volunteersQuery);

  const activeTasksForMap = useMemo(() => {
    return rawTasks?.filter(t => t.status === 'open') || [];
  }, [rawTasks]);

  const filteredTasks = useMemo(() => {
    if (!rawTasks) return [];
    let filtered = [...rawTasks];
    if (locationFilter !== "all") {
      filtered = filtered.filter(t => t.location === locationFilter);
    }
    return filtered.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const dateA = a.createdAt?.toMillis?.() || 0;
      const dateB = b.createdAt?.toMillis?.() || 0;
      return dateB - dateA;
    });
  }, [rawTasks, locationFilter]);

  const sortedVolunteers = useMemo(() => {
    if (!rawVolunteers) return [];
    return [...rawVolunteers].sort((a, b) => {
      const dateA = a.createdAt?.toMillis?.() || 0;
      const dateB = b.createdAt?.toMillis?.() || 0;
      return dateB - dateA;
    });
  }, [rawVolunteers]);

  const areaImpact = useMemo(() => {
    const counts: Record<string, number> = {};
    rawTasks?.filter(t => t.status === 'open').forEach(t => {
      counts[t.location] = (counts[t.location] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, tasks: count }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [rawTasks]);

  const matches = useMemo(() => {
    if (!rawTasks || !sortedVolunteers) return [];
    
    const results: Match[] = [];
    rawTasks.filter(t => t.status === 'open').forEach(task => {
      sortedVolunteers.forEach(volunteer => {
        let score = 0;
        const reasons: string[] = [];

        const matchedSkills = task.skillsRequired.filter(skill => 
          volunteer.skills.some(vSkill => vSkill.toLowerCase() === skill.toLowerCase())
        );
        if (matchedSkills.length > 0) {
          score += matchedSkills.length * 20;
          reasons.push(`${matchedSkills.length} skills matched`);
        }

        if (task.location.toLowerCase() === volunteer.location.toLowerCase()) {
          score += 40;
          reasons.push("Geographic Proximity");
        }

        if (score > 0) {
          results.push({
            taskId: task.id,
            volunteerId: volunteer.id,
            score: score + (task.priority * 15),
            reasons,
            taskTitle: task.title,
            volunteerName: volunteer.name
          });
        }
      });
    });

    return results.sort((a, b) => b.score - a.score);
  }, [rawTasks, sortedVolunteers]);

  const handleFetchNGOData = async () => {
    if (!db || !user) return;
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
        title: "NGO Data Synchronized",
        description: `Successfully imported ${SAMPLE_NGO_DATA.length} humanitarian tasks.`,
      });
    } catch (error) {
      // Handled globally
    } finally {
      setIsImporting(false);
    }
  };

  const handleFocusCritical = () => {
    const highUrgency = rawTasks?.find(t => t.urgency === 'high' && t.status === 'open');
    if (highUrgency && highUrgency.latitude) {
      setMapCenter([highUrgency.latitude, highUrgency.longitude]);
      setMapZoom(12);
      toast({ title: "Map Focused", description: "Zoomed into high-urgency incident zone." });
    } else {
      toast({ variant: "destructive", title: "No Data", description: "No active high-urgency tasks found to focus on." });
    }
  };

  const handleAssignVolunteer = (taskId: string, volunteerName: string) => {
    if (!db) return;
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "assigned",
      assignedTo: volunteerName,
      updatedAt: serverTimestamp(),
    });
    toast({
      title: "Task Assigned",
      description: `Task has been marked as assigned and removed from active matching.`,
    });
  };

  const handleMarkAsCompleted = (taskId: string) => {
    if (!db) return;
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "completed",
      updatedAt: serverTimestamp(),
    });
    toast({
      title: "Task Completed",
      description: `The task has been successfully fulfilled.`,
    });
  };

  if (isUserLoading || tasksLoading || volunteersLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight font-headline text-foreground">Relief Command Center</h1>
            <p className="text-muted-foreground">Strategic real-time mapping and resource mobilization.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={handleFocusCritical}>
              <Crosshair className="h-4 w-4 text-red-500" /> Focus Critical Area
            </Button>
            <Button 
              variant="default" 
              className="shadow-sm gap-2"
              onClick={handleFetchNGOData}
              disabled={isImporting}
            >
              <Database className="h-4 w-4" />
              {isImporting ? "Fetching..." : "Fetch NGO Data"}
            </Button>
            <div className="flex h-10 items-center gap-4 bg-card px-4 rounded-xl shadow-sm border">
               <div className="flex items-center gap-1.5 border-r pr-4">
                 <Activity className="h-4 w-4 text-primary" />
                 <span className="text-sm font-bold">{rawTasks?.filter(t => t.status === 'open').length || 0}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold ml-1">Needs</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <Users className="h-4 w-4 text-accent" />
                 <span className="text-sm font-bold">{sortedVolunteers.length}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold ml-1">Rescuers</span>
               </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          <div className="lg:col-span-3 space-y-8">
            <Card className="border-none shadow-xl overflow-hidden min-h-[450px] relative bg-card">
              <InteractiveMap 
                tasks={activeTasksForMap} 
                volunteers={rawVolunteers || []} 
                center={mapCenter} 
                zoom={mapZoom}
              />
              <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                <div className="bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border text-[10px] font-bold uppercase space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 border border-white" /> High Urgency
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500 border border-white" /> Medium Urgency
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white" /> Low Urgency
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" /> Rescuer
                  </div>
                </div>
              </div>
            </Card>

             <Tabs defaultValue="matches" className="space-y-8">
               <div className="flex justify-between items-center">
                 <TabsList className="grid w-full grid-cols-3 max-w-md h-12 bg-muted p-1 rounded-xl">
                   <TabsTrigger value="matches" className="rounded-lg">Smart Matches</TabsTrigger>
                   <TabsTrigger value="tasks" className="rounded-lg">Incident Feed</TabsTrigger>
                   <TabsTrigger value="volunteers" className="rounded-lg">Rescuers</TabsTrigger>
                 </TabsList>
               </div>

               <TabsContent value="matches" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {matches.length > 0 ? (
                     matches.filter(m => locationFilter === 'all' || m.reasons.some(r => r === "Geographic Proximity")).slice(0, 9).map((match, i) => (
                       <Card key={`${match.taskId}-${match.volunteerId}`} className="border-none shadow-md hover:shadow-xl transition-all duration-300 bg-card group flex flex-col">
                         <div className="absolute top-0 right-0 p-4">
                           <div className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                             <Zap className="h-3 w-3" /> {match.score} Score
                           </div>
                         </div>
                         <CardHeader className="pb-2">
                           <CardTitle className="text-lg flex items-center gap-2 font-bold">Smart Pairing</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4 flex-grow">
                           <div className="p-3 bg-muted/30 rounded-xl">
                             <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Impact Goal</p>
                             <p className="font-bold text-foreground truncate">{match.taskTitle}</p>
                           </div>
                           <div className="p-3 bg-primary/5 rounded-xl border-l-4 border-primary">
                             <p className="text-[10px] font-bold text-primary uppercase mb-1">Assigned Candidate</p>
                             <p className="font-bold text-foreground">{match.volunteerName}</p>
                           </div>
                         </CardContent>
                         <CardFooter className="pt-2">
                            <Button className="w-full gap-2" size="sm" onClick={() => handleAssignVolunteer(match.taskId, match.volunteerName)}>
                              <CheckCircle2 className="h-4 w-4" /> Assign Rescuer
                            </Button>
                         </CardFooter>
                       </Card>
                     ))
                   ) : (
                     <div className="col-span-full py-20 text-center bg-card rounded-3xl border-2 border-dashed">
                       <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                       <h3 className="text-lg font-bold text-muted-foreground">No matches detected.</h3>
                     </div>
                   )}
                 </div>
               </TabsContent>

               <TabsContent value="tasks" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {filteredTasks.map(task => (
                     <Card key={task.id} className={cn("border-none shadow-sm bg-card relative", task.status === 'completed' && "opacity-60")}>
                       <CardHeader className="pb-2">
                         <div className="flex justify-between items-start mb-2">
                           <Badge className={cn("text-[10px] uppercase font-bold", 
                             task.urgency === 'high' ? "bg-red-500" : 
                             task.urgency === 'medium' ? "bg-amber-500" : "bg-emerald-500")}>
                             {task.urgency}
                           </Badge>
                           <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold">
                             <MapPin className="h-3 w-3" /> {task.location}
                           </div>
                         </div>
                         <CardTitle className="text-lg font-bold truncate">{task.title}</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4 pt-2">
                         <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                       </CardContent>
                       <CardFooter className="pt-0 flex gap-2">
                         {task.status === 'open' && (
                           <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => handleMarkAsCompleted(task.id)}>
                             <CheckCircle className="h-3 w-3 mr-2" /> Complete
                           </Button>
                         )}
                         <Button variant="outline" size="sm" className="text-xs" onClick={() => { setMapCenter([task.latitude, task.longitude]); setMapZoom(15); }}>
                           <MapIcon className="h-3 w-3" /> View Map
                         </Button>
                       </CardFooter>
                     </Card>
                   ))}
                 </div>
               </TabsContent>
               
               <TabsContent value="volunteers" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {sortedVolunteers.filter(v => locationFilter === 'all' || v.location === locationFilter).map(volunteer => (
                     <Card key={volunteer.id} className="border-none shadow-sm bg-card">
                       <CardHeader className="pb-2">
                         <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-semibold mb-2">
                           <MapPin className="h-3 w-3 text-accent" /> {volunteer.location}
                         </div>
                         <CardTitle className="text-lg font-bold">{volunteer.name}</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4 pt-2">
                         <div className="flex flex-wrap gap-2">
                           {volunteer.skills.map((skill, idx) => (
                             <Badge key={idx} variant="secondary" className="text-[10px]">{skill}</Badge>
                           ))}
                         </div>
                       </CardContent>
                       <CardFooter className="pt-0">
                         <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setMapCenter([volunteer.latitude, volunteer.longitude]); setMapZoom(15); }}>
                           <MapIcon className="h-3 w-3 mr-2" /> Locate
                         </Button>
                       </CardFooter>
                     </Card>
                   ))}
                 </div>
               </TabsContent>
             </Tabs>
          </div>

          <aside className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm border-none bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Regional Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <BarChart data={areaImpact} layout="vertical" margin={{ left: -20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[10px] font-bold" />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="tasks" radius={4}>
                      {areaImpact.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                
                <div className="mt-6 space-y-1">
                  <Button variant={locationFilter === 'all' ? 'default' : 'ghost'} size="sm" className="w-full justify-start text-xs h-8" onClick={() => setLocationFilter('all')}>
                    <Activity className="h-3 w-3 mr-2" /> Global Perspective
                  </Button>
                  {areaImpact.map((area) => (
                    <Button key={area.name} variant={locationFilter === area.name ? 'secondary' : 'ghost'} size="sm" className="w-full justify-between text-xs h-8" onClick={() => setLocationFilter(area.name)}>
                      <span className="flex items-center"><MapPin className="h-3 w-3 mr-2" /> {area.name}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">{area.tasks}</Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-accent/5">
               <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-bold uppercase text-accent">Optimization Log</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="p-3 bg-white rounded-lg border-l-4 border-emerald-500 shadow-sm text-[11px] leading-relaxed">
                    Once a task is fulfilled, it is automatically marked as completed and removed from active matching, ensuring efficient resource utilization.
                  </div>
               </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
