"use client"

import { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Zap, AlertTriangle, Database, Activity, Loader2, BarChart3, Map as MapIcon, CheckCircle, Crosshair, Plus, Minus, Navigation, X, Route, UserCheck, ShieldCheck, Target } from "lucide-react";
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

const InteractiveMap = dynamic(() => import("@/components/Map"), { 
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-muted animate-pulse rounded-2xl flex items-center justify-center text-muted-foreground border-2 border-dashed font-bold uppercase tracking-[0.2em] text-sm">Initializing Tactical Grid...</div>
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
  location: string;
}

const SAMPLE_NGO_DATA = [
  { title: "Critical Food Supply Chain", description: "Strategic distribution network for 1500+ displaced families in North Sector.", skillsRequired: ["Logistics", "Operations"], location: "Kolkata", latitude: 22.5726, longitude: 88.3639, urgency: "high", priority: 3, status: "open", submittedBy: "WFP Operational Partner" },
  { title: "Mobile Trauma Unit", description: "Emergency clinical support for high-impact zones in Central Delhi.", skillsRequired: ["Healthcare", "Emergency Medicine"], location: "Delhi", latitude: 28.6139, longitude: 77.2090, urgency: "high", priority: 3, status: "open", submittedBy: "Medical Corps" },
  { title: "Relief Logistics Hub", description: "Tier 1 warehouse management for incoming international aid supplies.", skillsRequired: ["Logistics", "Inventory"], location: "Mumbai", latitude: 19.0760, longitude: 72.8777, urgency: "medium", priority: 2, status: "open", submittedBy: "Logistics Cluster" },
  { title: "Response Comms Center", description: "Coordinating field data for inter-agency disaster response teams.", skillsRequired: ["Admin", "IT Support"], location: "Delhi", latitude: 28.7041, longitude: 77.1025, urgency: "low", priority: 1, status: "open", submittedBy: "Emergency Comms NGO" },
];

const chartConfig = {
  tasks: {
    label: "Incident Density",
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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasksQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "tasks");
  }, [db]);

  const volunteersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, "volunteerProfiles");
  }, [db]);

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
          score += matchedSkills.length * 30;
          reasons.push(`${matchedSkills.length} Core Competencies`);
        }

        if (task.location.toLowerCase() === volunteer.location.toLowerCase()) {
          score += 60;
          reasons.push("Rapid Response (Local)");
        }

        if (score > 40) {
          results.push({
            taskId: task.id,
            volunteerId: volunteer.id,
            score: score + (task.priority * 15),
            reasons,
            taskTitle: task.title,
            volunteerName: volunteer.name,
            location: volunteer.location
          });
        }
      });
    });

    return results.sort((a, b) => b.score - a.score);
  }, [rawTasks, sortedVolunteers]);

  const areaImpact = useMemo(() => {
    const counts: Record<string, number> = {};
    rawTasks?.filter(t => t.status === 'open').forEach(t => {
      counts[t.location] = (counts[t.location] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, tasks: count }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [rawTasks]);

  const handleTaskSelect = (taskId: string | null) => {
    setSelectedTaskId(taskId);
    if (taskId) {
      const task = rawTasks?.find(t => t.id === taskId);
      if (task && task.latitude) {
        setMapCenter([task.latitude, task.longitude]);
        setMapZoom(15);
      }
    }
  };

  const handleRegionClick = (regionName: string) => {
    setLocationFilter(regionName);
    setSelectedTaskId(null);
    if (regionName === 'all') {
      setMapCenter([20.5937, 78.9629]);
      setMapZoom(5);
      return;
    }

    const regionalTask = rawTasks?.find(t => t.location === regionName);
    if (regionalTask && regionalTask.latitude && regionalTask.longitude) {
      setMapCenter([regionalTask.latitude, regionalTask.longitude]);
      setMapZoom(12);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Access Denied", description: "Geolocation services are required for tactical pathing." });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setMapZoom(14);
        setIsLocating(false);
        toast({ title: "Coordinates Locked", description: "Your current responder position has been verified." });
      },
      (error) => {
        setIsLocating(false);
        toast({ variant: "destructive", title: "Sync Failed", description: "Ensure location permissions are enabled for this domain." });
      },
      { enableHighAccuracy: true }
    );
  };

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
      toast({ title: "Database Synchronized", description: "Imported verified humanitarian missions from international partners." });
    } catch (error) { } finally {
      setIsImporting(false);
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
    toast({ title: "Mission Assigned", description: `${volunteerName} is now leading field operations for this request.` });
  };

  const handleMarkAsCompleted = (taskId: string) => {
    if (!db) return;
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "completed",
      updatedAt: serverTimestamp(),
    });
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    toast({ title: "Mission Successful", description: `Field request has been marked as resolved and logged.` });
  };

  if (isUserLoading || tasksLoading || volunteersLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Synchronizing Fleet Data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight font-headline text-foreground flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-primary" />
              Operational Command
            </h1>
            <p className="text-muted-foreground font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Real-time Humanitarian Grid Active
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button 
              variant="outline" 
              className="h-12 px-6 rounded-xl font-bold gap-2 border-2 hover:bg-primary/5 hover:text-primary transition-all" 
              onClick={handleLocateMe}
              disabled={isLocating}
            >
              <Navigation className={cn("h-5 w-5", isLocating && "animate-pulse")} />
              {isLocating ? "Locating..." : "Verify Position"}
            </Button>
            <Button 
              variant="default" 
              className="h-12 px-6 rounded-xl font-bold shadow-xl shadow-primary/20 gap-2"
              onClick={handleFetchNGOData}
              disabled={isImporting}
            >
              <Database className="h-5 w-5" />
              {isImporting ? "Importing Data..." : "Sync Global Intel"}
            </Button>
            <div className="flex h-12 items-center gap-6 bg-card border-2 px-6 rounded-xl shadow-sm">
               <div className="flex items-center gap-2 border-r pr-6">
                 <Target className="h-5 w-5 text-destructive" />
                 <span className="text-lg font-black">{rawTasks?.filter(t => t.status === 'open').length || 0}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-black ml-1">Open Risks</span>
               </div>
               <div className="flex items-center gap-2">
                 <Users className="h-5 w-5 text-primary" />
                 <span className="text-lg font-black">{sortedVolunteers.length}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-black ml-1">Responders</span>
               </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          <div className="lg:col-span-9 space-y-8">
            <Card className="border-2 shadow-2xl overflow-hidden h-[500px] relative bg-card rounded-3xl">
              <InteractiveMap 
                tasks={activeTasksForMap} 
                volunteers={rawVolunteers || []} 
                center={mapCenter} 
                zoom={mapZoom}
                userLocation={userLocation}
                selectedTaskId={selectedTaskId}
                onTaskSelect={handleTaskSelect}
              />
              <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
                {selectedTaskId && userLocation && (
                   <div className="glass px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-8 ring-2 ring-primary">
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-black text-primary tracking-widest mb-0.5">Tactical Path Locked</span>
                       <span className="text-sm font-black truncate max-w-[200px]">
                         {activeTasksForMap.find(t => t.id === selectedTaskId)?.title}
                       </span>
                     </div>
                     <Button 
                       size="icon" 
                       variant="ghost" 
                       className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive rounded-full" 
                       onClick={() => setSelectedTaskId(null)}
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   </div>
                )}
                <div className="glass p-5 rounded-2xl shadow-2xl space-y-3 min-w-[200px]">
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-4 tracking-[0.15em]">Grid Legend</h4>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-destructive border-2 border-white shadow-sm" /> High Priority Risk
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm" /> Medium Priority Risk
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" /> Standard Risk
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-white shadow-sm" /> Active Responder
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-purple-600 border-2 border-white shadow-sm ring-2 ring-purple-100 dark:ring-purple-900/30" /> Your Location
                  </div>
                </div>
              </div>
              <div className="absolute bottom-6 left-6 z-[1000] flex gap-3">
                <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl shadow-xl border-2 hover:scale-105 transition-transform" onClick={() => setMapZoom(prev => Math.min(prev + 1, 18))}>
                  <Plus className="h-6 w-6" />
                </Button>
                <Button size="icon" variant="secondary" className="h-11 w-11 rounded-2xl shadow-xl border-2 hover:scale-105 transition-transform" onClick={() => setMapZoom(prev => Math.max(prev - 1, 3))}>
                  <Minus className="h-6 w-6" />
                </Button>
              </div>
            </Card>

             <Tabs defaultValue="matches" className="space-y-8">
               <div className="flex justify-between items-center bg-card p-2 rounded-2xl border-2 shadow-sm">
                 <TabsList className="grid w-full grid-cols-3 max-w-lg h-12 bg-muted/50 p-1 rounded-xl">
                   <TabsTrigger value="matches" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Deployment Matches</TabsTrigger>
                   <TabsTrigger value="tasks" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Intelligence Feed</TabsTrigger>
                   <TabsTrigger value="volunteers" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Personnel Registry</TabsTrigger>
                 </TabsList>
               </div>

               <TabsContent value="matches" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {matches.length > 0 ? (
                     matches.filter(m => locationFilter === 'all' || m.location === locationFilter).slice(0, 9).map((match, i) => (
                       <Card key={`${match.taskId}-${match.volunteerId}`} className="border-2 shadow-lg hover:shadow-2xl transition-all duration-300 bg-card group flex flex-col relative overflow-hidden rounded-3xl group">
                         <div className="absolute top-0 right-0 p-5">
                           <div className="bg-primary/10 text-primary text-[10px] font-black uppercase px-4 py-1.5 rounded-full flex items-center gap-2 border-2 border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                             <Zap className="h-4 w-4" /> Score: {match.score}
                           </div>
                         </div>
                         <CardHeader className="pb-4">
                           <CardTitle className="text-xl font-black text-foreground">Strategic Allocation</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-5 flex-grow">
                           <div className="p-4 bg-muted/50 rounded-2xl border-l-4 border-destructive space-y-1">
                             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Incident Sector: {match.location}</p>
                             <p className="font-extrabold text-foreground text-sm leading-snug">{match.taskTitle}</p>
                           </div>
                           <div className="p-4 bg-primary/5 rounded-2xl border-l-4 border-primary space-y-1">
                             <p className="text-[10px] font-black text-primary uppercase tracking-widest">Recommended Responder</p>
                             <p className="font-extrabold text-foreground text-sm">{match.volunteerName}</p>
                           </div>
                           <div className="flex flex-wrap gap-2">
                             {match.reasons.map((r, idx) => (
                               <Badge key={idx} variant="secondary" className="text-[9px] font-black uppercase tracking-tight py-1 px-2.5 rounded-lg border-2">{r}</Badge>
                             ))}
                           </div>
                         </CardContent>
                         <CardFooter className="pt-4 border-t bg-muted/20">
                            <Button className="w-full h-12 gap-2 font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg" onClick={() => handleAssignVolunteer(match.taskId, match.volunteerName)}>
                              <UserCheck className="h-5 w-5" /> Execute Deployment
                            </Button>
                         </CardFooter>
                       </Card>
                     ))
                   ) : (
                     <div className="col-span-full py-24 text-center bg-card rounded-[3rem] border-2 border-dashed">
                       <Zap className="h-16 w-16 text-muted-foreground/20 mx-auto mb-6" />
                       <h3 className="text-2xl font-black text-muted-foreground uppercase tracking-tighter">No High-Confidence Matches Detected</h3>
                       <p className="text-sm text-muted-foreground mt-3 font-semibold max-w-sm mx-auto">Import global intel or refresh the grid to identify new responder opportunities.</p>
                     </div>
                   )}
                 </div>
               </TabsContent>

               <TabsContent value="tasks" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {filteredTasks.map(task => (
                     <Card 
                       key={task.id} 
                       className={cn(
                         "border-2 shadow-md bg-card relative transition-all hover:shadow-xl rounded-3xl group", 
                         task.status === 'completed' && "opacity-50 grayscale",
                         selectedTaskId === task.id && "ring-4 ring-primary ring-offset-4"
                       )}
                     >
                       <CardHeader className="pb-4">
                         <div className="flex justify-between items-start mb-3">
                           <Badge className={cn("text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-xl", 
                             task.urgency === 'high' ? "bg-destructive text-destructive-foreground" : 
                             task.urgency === 'medium' ? "bg-amber-500 text-white" : "bg-emerald-500 text-white")}>
                             {task.urgency} Priority
                           </Badge>
                           <div className="flex items-center gap-2 text-muted-foreground text-xs font-black uppercase tracking-wider">
                             <MapPin className="h-4 w-4 text-primary" /> {task.location}
                           </div>
                         </div>
                         <CardTitle className="text-xl font-black truncate leading-tight">{task.title}</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4 pt-0">
                         <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed font-medium">{task.description}</p>
                       </CardContent>
                       <CardFooter className="pt-4 border-t flex gap-3">
                         {task.status === 'open' && (
                           <Button variant="ghost" size="sm" className="flex-1 text-[11px] font-black uppercase tracking-widest h-11 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors" onClick={() => handleMarkAsCompleted(task.id)}>
                             <CheckCircle className="h-4 w-4 mr-2" /> Fulfil
                           </Button>
                         )}
                         <Button 
                           variant={selectedTaskId === task.id ? "default" : "outline"} 
                           size="sm" 
                           className="flex-1 text-[11px] font-black uppercase tracking-widest h-11 rounded-xl shadow-sm border-2" 
                           onClick={() => handleTaskSelect(task.id)}
                         >
                           <Route className="h-4 w-4 mr-2" /> Tactical Path
                         </Button>
                       </CardFooter>
                     </Card>
                   ))}
                 </div>
               </TabsContent>
               
               <TabsContent value="volunteers" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {sortedVolunteers.filter(v => locationFilter === 'all' || v.location === locationFilter).map(volunteer => (
                     <Card key={volunteer.id} className="border-2 shadow-md bg-card rounded-3xl hover:shadow-xl transition-all group overflow-hidden">
                       <div className="h-2 bg-primary" />
                       <CardHeader className="pb-4">
                         <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest mb-3">
                           <MapPin className="h-4 w-4 text-primary" /> Sector {volunteer.location}
                         </div>
                         <CardTitle className="text-xl font-black flex items-center justify-between">
                           {volunteer.name}
                           <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest py-1 border-2">Verified</Badge>
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-5 pt-0">
                         <div className="flex flex-wrap gap-2">
                           {volunteer.skills.map((skill, idx) => (
                             <Badge key={idx} variant="secondary" className="text-[10px] font-bold py-1 px-3 rounded-lg bg-muted border-2">{skill}</Badge>
                           ))}
                         </div>
                         <div className="pt-4 border-t bg-muted/10 p-4 rounded-2xl flex items-center justify-between">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                               <Zap className="h-4 w-4 text-amber-500" />
                               Proximity Risks
                            </p>
                            <span className="text-lg font-black">{activeTasksForMap.filter(t => t.location === volunteer.location).length}</span>
                         </div>
                       </CardContent>
                       <CardFooter className="pt-4 bg-muted/20">
                         <Button variant="outline" size="sm" className="w-full text-[11px] font-black uppercase tracking-widest h-12 rounded-xl border-2 hover:bg-primary hover:text-white transition-all" onClick={() => { setMapCenter([volunteer.latitude, volunteer.longitude]); setMapZoom(16); }}>
                           <MapIcon className="h-4 w-4 mr-2" /> Locate Personnel
                         </Button>
                       </CardFooter>
                     </Card>
                   ))}
                 </div>
               </TabsContent>
             </Tabs>
          </div>

          <aside className="lg:col-span-3 space-y-8">
            <Card className="shadow-2xl border-2 bg-primary/[0.02] rounded-[2rem] overflow-hidden">
              <CardHeader className="pb-4 bg-primary/5 border-b-2">
                <CardTitle className="text-xs font-black flex items-center gap-3 uppercase tracking-[0.2em] text-primary">
                  <BarChart3 className="h-5 w-5" /> Risk Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8 space-y-8">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart 
                    data={areaImpact} 
                    layout="vertical" 
                    margin={{ left: -10 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[10px] font-black uppercase text-muted-foreground" />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar 
                      dataKey="tasks" 
                      radius={[0, 8, 8, 0]}
                      className="cursor-pointer"
                      onClick={(data) => {
                        if (data && data.name) handleRegionClick(data.name);
                      }}
                    >
                      {areaImpact.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                
                <div className="space-y-3">
                  <Button 
                    variant={locationFilter === 'all' ? 'default' : 'outline'} 
                    size="sm" 
                    className="w-full justify-start text-[11px] h-12 font-black uppercase tracking-widest rounded-xl border-2" 
                    onClick={() => handleRegionClick('all')}
                  >
                    <Activity className="h-4 w-4 mr-3" /> Full Grid View
                  </Button>
                  {areaImpact.map((area) => (
                    <Button 
                      key={area.name} 
                      variant={locationFilter === area.name ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="w-full justify-between text-[11px] h-12 font-black uppercase tracking-widest rounded-xl border-2 group transition-all" 
                      onClick={() => handleRegionClick(area.name)}
                    >
                      <span className="flex items-center"><MapPin className="h-4 w-4 mr-3 text-primary group-hover:scale-110 transition-transform" /> {area.name}</span>
                      <Badge variant="outline" className="text-[10px] h-6 px-2.5 font-black bg-white/50 border-2">{area.tasks}</Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 shadow-lg bg-muted/30 rounded-[2rem] overflow-hidden">
               <CardHeader className="pb-4 bg-muted border-b-2">
                 <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-3">
                   <Activity className="h-5 w-5 text-emerald-500" />
                   System Logs
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-5 pt-8 p-6">
                  <div className="p-5 bg-card rounded-2xl border-l-8 border-emerald-500 shadow-sm text-[12px] font-bold leading-relaxed">
                    Centering on your location identifies local needs where immediate impact is possible. 
                    <span className="block mt-2 text-emerald-600 font-black tracking-widest uppercase text-[10px]">Sync complete.</span>
                  </div>
                  {selectedTaskId && userLocation && (
                    <div className="p-5 bg-primary/5 rounded-2xl border-l-8 border-primary shadow-sm text-[12px] font-bold leading-relaxed animate-pulse">
                      Tactical overlay rendering direct response vector to incident site. Deploy immediately.
                    </div>
                  )}
               </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}