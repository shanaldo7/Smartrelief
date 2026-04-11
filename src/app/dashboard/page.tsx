
"use client"

import { useState, useMemo, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, serverTimestamp, doc, query, orderBy, limit } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Zap, AlertTriangle, Database, Activity, Loader2, BarChart3, Map as MapIcon, CheckCircle, Crosshair, Plus, Minus, Navigation, X, Route, UserCheck, ShieldCheck, Target, LocateFixed, Briefcase, UserCircle, Filter, FilterX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const InteractiveMap = dynamic(() => import("@/components/Map"), { 
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-muted animate-pulse rounded-2xl flex items-center justify-center text-muted-foreground border-2 border-dashed font-bold uppercase tracking-[0.2em] text-sm">Initializing Tactical Grid...</div>
});

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  latitude: number;
  longitude: number;
  urgency: "low" | "medium" | "high";
  priority: number;
  skillsRequired: string[];
  status: string;
  ownerId: string;
  submittedBy: string;
  assignedTo?: string;
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
  distance: string;
}

interface ActivityLog {
  id: string;
  message: string;
  type: "new_task" | "assigned" | "completed";
  timestamp: any;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const SAMPLE_NGO_DATA = [
  { title: "Critical Food Supply Chain", category: "Food", description: "Strategic distribution network for 1500+ displaced families in North Sector.", skillsRequired: ["Logistics", "Operations"], location: "Kolkata", latitude: 22.5726, longitude: 88.3639, urgency: "high", priority: 3, status: "open", submittedBy: "WFP Operational Partner" },
  { title: "Mobile Trauma Unit", category: "Medical", description: "Emergency clinical support for high-impact zones in Central Delhi.", skillsRequired: ["Healthcare", "Emergency Medicine"], location: "Delhi", latitude: 28.6139, longitude: 77.2090, urgency: "high", priority: 3, status: "open", submittedBy: "Medical Corps" },
  { title: "Relief Logistics Hub", category: "Logistics", description: "Tier 1 warehouse management for incoming international aid supplies.", skillsRequired: ["Logistics", "Inventory"], location: "Mumbai", latitude: 19.0760, longitude: 72.8777, urgency: "medium", priority: 2, status: "open", submittedBy: "Logistics Cluster" },
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
  const [simulationRole, setSimulationRole] = useState<"ngo" | "volunteer">("ngo");
  const [isImporting, setIsImporting] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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

  const activitiesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(10));
  }, [db]);

  const { data: rawTasks, isLoading: tasksLoading } = useCollection<Task>(tasksQuery);
  const { data: rawVolunteers, isLoading: volunteersLoading } = useCollection<Volunteer>(volunteersQuery);
  const { data: activities, isLoading: activitiesLoading } = useCollection<ActivityLog>(activitiesQuery);

  const activeTasksForMap = useMemo(() => {
    return rawTasks?.filter(t => t.status === 'open') || [];
  }, [rawTasks]);

  const stableVolunteers = useMemo(() => {
    return rawVolunteers || [];
  }, [rawVolunteers]);

  const filteredTasks = useMemo(() => {
    if (!rawTasks) return [];
    let filtered = [...rawTasks];
    if (locationFilter !== "all") filtered = filtered.filter(t => t.location === locationFilter);
    if (urgencyFilter !== "all") filtered = filtered.filter(t => t.urgency === urgencyFilter);
    if (categoryFilter !== "all") filtered = filtered.filter(t => t.category === categoryFilter);

    return filtered.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const dateA = a.createdAt?.toMillis?.() || 0;
      const dateB = b.createdAt?.toMillis?.() || 0;
      return dateB - dateA;
    });
  }, [rawTasks, locationFilter, urgencyFilter, categoryFilter]);

  const myAssignments = useMemo(() => {
    if (!rawTasks || !user) return [];
    return rawTasks.filter(t => t.assignedTo === (user.displayName || "Anonymous Volunteer"));
  }, [rawTasks, user]);

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
        const dist = getDistance(task.latitude, task.longitude, volunteer.latitude, volunteer.longitude);
        let score = 0;
        const reasons: string[] = [];
        const proximityScore = Math.max(0, 150 - (dist / 2)); 
        score += proximityScore;
        if (dist < 5) reasons.push("Critical Proximity (<5km)");
        else if (dist < 25) reasons.push("Immediate Sector (<25km)");
        const matchedSkills = task.skillsRequired.filter(skill => 
          volunteer.skills.some(vSkill => vSkill.toLowerCase() === skill.toLowerCase())
        );
        if (matchedSkills.length > 0) {
          score += matchedSkills.length * 40;
          reasons.push(`${matchedSkills.length} Required Skills`);
        }
        score += (task.priority * 20);
        if (score > 60) {
          results.push({
            taskId: task.id,
            volunteerId: volunteer.id,
            score: Math.round(score),
            reasons,
            taskTitle: task.title,
            volunteerName: volunteer.name,
            location: task.location,
            distance: dist.toFixed(1)
          });
        }
      });
    });
    return results.sort((a, b) => b.score - a.score);
  }, [rawTasks, sortedVolunteers]);

  const nearbyOpportunities = useMemo(() => {
    if (!userLocation || !rawTasks) return [];
    return rawTasks
      .filter(t => t.status === 'open')
      .map(t => ({
        ...t,
        distance: getDistance(userLocation[0], userLocation[1], t.latitude, t.longitude)
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [userLocation, rawTasks]);

  const areaImpact = useMemo(() => {
    const counts: Record<string, number> = {};
    rawTasks?.filter(t => t.status === 'open').forEach(t => {
      counts[t.location] = (counts[t.location] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, tasks: count }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [rawTasks]);

  const logActivity = useCallback((type: "new_task" | "assigned" | "completed", message: string) => {
    if (!db) return;
    const actRef = doc(collection(db, "activities"));
    setDocumentNonBlocking(actRef, {
      id: actRef.id,
      type,
      message,
      timestamp: serverTimestamp()
    }, { merge: true });
  }, [db]);

  const handleTaskSelect = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    if (taskId) {
      const task = rawTasks?.find(t => t.id === taskId);
      if (task && task.latitude) {
        setMapCenter([task.latitude, task.longitude]);
        setMapZoom(15);
      }
    }
  }, [rawTasks]);

  const handleFocusEmergency = useCallback(() => {
    if (!rawTasks) return;
    const criticalTask = [...rawTasks]
      .filter(t => t.status === 'open')
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return 0;
      })[0];

    if (criticalTask) {
      setSelectedTaskId(criticalTask.id);
      setMapCenter([criticalTask.latitude, criticalTask.longitude]);
      setMapZoom(16);
      toast({ title: "Focus Locked", description: `Emergency focal point: ${criticalTask.title}` });
    } else {
      toast({ variant: "destructive", title: "No Emergencies", description: "All sectors currently operational." });
    }
  }, [rawTasks, toast]);

  const handleRegionClick = useCallback((regionName: string) => {
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
  }, [rawTasks]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Access Denied", description: "Geolocation required." });
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
        toast({ title: "Position Locked", description: "Responder position verified." });
      },
      () => {
        setIsLocating(false);
        toast({ variant: "destructive", title: "Sync Failed", description: "Check permissions." });
      },
      { enableHighAccuracy: true }
    );
  }, [toast]);

  const handleFetchNGOData = useCallback(async () => {
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
        logActivity("new_task", `New ${item.category} mission added in ${item.location}`);
      }
      toast({ title: "Database Synchronized", description: "Imported verified missions." });
    } catch (error) { } finally {
      setIsImporting(false);
    }
  }, [db, user, toast, logActivity]);

  const handleAssignVolunteer = useCallback((taskId: string, volunteerName: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "assigned",
      assignedTo: volunteerName,
      updatedAt: serverTimestamp(),
    });
    logActivity("assigned", `${volunteerName} assigned to ${task?.title || 'task'} (${task?.location})`);
    toast({ title: "Mission Assigned", description: `${volunteerName} deployed.` });
  }, [db, toast, rawTasks, logActivity]);

  const handleMarkAsCompleted = useCallback((taskId: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "completed",
      updatedAt: serverTimestamp(),
    });
    logActivity("completed", `Task completed: ${task?.title} (${task?.location})`);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    toast({ title: "Mission Successful", description: `Field request resolved.` });
  }, [db, selectedTaskId, toast, rawTasks, logActivity]);

  if (isUserLoading || tasksLoading || volunteersLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Synchronizing Tactical Grid...</p>
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
              Command Center
            </h1>
            <p className="text-muted-foreground font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Role: <span className="text-foreground uppercase font-black">{simulationRole} Perspective</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="bg-muted p-1 rounded-2xl flex gap-1 border-2">
              <Button 
                variant={simulationRole === 'ngo' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-black uppercase text-[10px] tracking-widest px-6 h-10", simulationRole === 'ngo' && "shadow-lg")}
                onClick={() => setSimulationRole('ngo')}
              >
                <Briefcase className="h-4 w-4 mr-2" /> NGO Panel
              </Button>
              <Button 
                variant={simulationRole === 'volunteer' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-black uppercase text-[10px] tracking-widest px-6 h-10", simulationRole === 'volunteer' && "shadow-lg")}
                onClick={() => setSimulationRole('volunteer')}
              >
                <UserCircle className="h-4 w-4 mr-2" /> Volunteer Panel
              </Button>
            </div>
            <div className="flex gap-4">
              <Button 
                variant="destructive" 
                className="h-12 px-6 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-destructive/20 gap-2 border-2" 
                onClick={handleFocusEmergency}
              >
                <AlertTriangle className="h-5 w-5" />
                🚨 Focus Emergency
              </Button>
              <Button 
                variant="outline" 
                className="h-12 px-6 rounded-xl font-bold gap-2 border-2" 
                onClick={handleLocateMe}
                disabled={isLocating}
              >
                <Navigation className={cn("h-5 w-5", isLocating && "animate-pulse")} />
                {isLocating ? "Locating..." : "Detect Position"}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          <div className="lg:col-span-9 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-3xl border-2">
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Filter Sector</p>
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="rounded-xl border-2"><SelectValue placeholder="Category" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Categories</SelectItem>
                     <SelectItem value="Food">Food Relief</SelectItem>
                     <SelectItem value="Medical">Medical Support</SelectItem>
                     <SelectItem value="Teaching">Education</SelectItem>
                     <SelectItem value="Logistics">Supply Chain</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase text-muted-foreground ml-1">Urgency Threshold</p>
                 <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                   <SelectTrigger className="rounded-xl border-2"><SelectValue placeholder="Urgency" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Levels</SelectItem>
                     <SelectItem value="high">Critical Only</SelectItem>
                     <SelectItem value="medium">Medium + High</SelectItem>
                     <SelectItem value="low">Standard</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex items-end">
                 <Button variant="ghost" className="w-full rounded-xl font-black uppercase text-[10px] tracking-widest h-10 border-2 border-dashed" onClick={() => { setCategoryFilter('all'); setUrgencyFilter('all'); setLocationFilter('all'); }}>
                   <FilterX className="h-4 w-4 mr-2" /> Reset Filters
                 </Button>
               </div>
            </div>

            <Card className="border-2 shadow-2xl overflow-hidden h-[500px] relative bg-card rounded-3xl">
              <InteractiveMap 
                tasks={activeTasksForMap} 
                volunteers={stableVolunteers} 
                center={mapCenter} 
                zoom={mapZoom}
                userLocation={userLocation}
                selectedTaskId={selectedTaskId}
                onTaskSelect={handleTaskSelect}
              />
              <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-3">
                <div className="glass p-5 rounded-2xl shadow-2xl space-y-3 min-w-[200px]">
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-4 tracking-[0.15em]">Grid Legend</h4>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-destructive border-2 border-white shadow-sm" /> High Priority
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm" /> Medium Priority
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" /> Standard
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <div className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-white shadow-sm" /> Responder
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

             {simulationRole === 'ngo' ? (
               <Tabs defaultValue="matches" className="space-y-8">
                 <TabsList className="grid w-full grid-cols-3 max-w-lg h-12 bg-muted p-1 rounded-xl">
                   <TabsTrigger value="matches" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Smart Matches</TabsTrigger>
                   <TabsTrigger value="missions" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Active Missions</TabsTrigger>
                   <TabsTrigger value="personnel" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Vetted Personnel</TabsTrigger>
                 </TabsList>

                 <TabsContent value="matches" className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {matches.length > 0 ? (
                       matches.slice(0, 9).map((match) => (
                         <Card key={`${match.taskId}-${match.volunteerId}`} className="border-2 shadow-lg hover:shadow-2xl transition-all duration-300 bg-card group rounded-3xl overflow-hidden flex flex-col">
                           <CardHeader className="pb-4">
                             <div className="flex justify-between items-start">
                               <div className="space-y-1">
                                 <CardTitle className="text-xl font-black text-foreground">Strategic Match</CardTitle>
                                 <CardDescription className="text-[10px] font-black uppercase text-primary">Distance Score: {match.score}</CardDescription>
                               </div>
                               <Badge className="bg-primary/10 text-primary border-2 border-primary/20">{match.distance}km</Badge>
                             </div>
                           </CardHeader>
                           <CardContent className="space-y-4 flex-grow">
                             <div className="p-4 bg-muted/50 rounded-2xl border-l-4 border-destructive space-y-1">
                               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Incident</p>
                               <p className="font-extrabold text-foreground text-sm leading-snug">{match.taskTitle}</p>
                             </div>
                             <div className="p-4 bg-primary/5 rounded-2xl border-l-4 border-primary space-y-1">
                               <p className="text-[10px] font-black text-primary uppercase tracking-widest">Nearest Qualified</p>
                               <p className="font-extrabold text-foreground text-sm">{match.volunteerName}</p>
                             </div>
                           </CardContent>
                           <CardFooter className="pt-4 border-t bg-muted/20">
                              <Button className="w-full h-12 gap-2 font-black uppercase text-[11px] tracking-widest rounded-xl" onClick={() => handleAssignVolunteer(match.taskId, match.volunteerName)}>
                                <UserCheck className="h-5 w-5" /> Deploy Responder
                              </Button>
                           </CardFooter>
                         </Card>
                       ))
                     ) : (
                       <div className="col-span-full py-24 text-center bg-card rounded-[3rem] border-2 border-dashed">
                         <Zap className="h-16 w-16 text-muted-foreground/20 mx-auto mb-6" />
                         <h3 className="text-2xl font-black text-muted-foreground uppercase tracking-tighter">No Matches Detected</h3>
                         <p className="text-sm text-muted-foreground mt-3 font-semibold max-w-sm mx-auto">Sync data to identify new opportunities.</p>
                       </div>
                     )}
                   </div>
                 </TabsContent>

                 <TabsContent value="missions" className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {filteredTasks.map(task => (
                       <Card key={task.id} className={cn("border-2 shadow-md bg-card rounded-3xl overflow-hidden", task.status === 'completed' && "opacity-50")}>
                         <CardHeader className="pb-4">
                           <div className="flex justify-between items-start mb-3">
                             <div className="flex gap-2">
                               <Badge className={cn("text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-xl", 
                                 task.urgency === 'high' ? "bg-destructive text-destructive-foreground" : "bg-primary text-white")}>
                                 {task.urgency}
                               </Badge>
                               <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-2">{task.category}</Badge>
                             </div>
                             <div className="flex items-center gap-2 text-muted-foreground text-xs font-black uppercase tracking-wider">
                               <MapPin className="h-4 w-4 text-primary" /> {task.location}
                             </div>
                           </div>
                           <CardTitle className="text-xl font-black truncate">{task.title}</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4 pt-0">
                           <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed font-medium">{task.description}</p>
                           {task.assignedTo && (
                             <div className="flex items-center gap-2 pt-3 border-t">
                               <Badge variant="outline" className="text-emerald-600 border-emerald-500/20 bg-emerald-50 text-[10px] font-black uppercase px-3 py-1">Assigned to: {task.assignedTo}</Badge>
                             </div>
                           )}
                         </CardContent>
                         <CardFooter className="pt-4 border-t flex gap-3 bg-muted/20">
                           {task.status !== 'completed' && (
                             <Button variant="ghost" size="sm" className="flex-1 text-[11px] font-black uppercase tracking-widest h-11 rounded-xl" onClick={() => handleMarkAsCompleted(task.id)}>
                               <CheckCircle className="h-4 w-4 mr-2" /> Complete
                             </Button>
                           )}
                           <Button variant="outline" size="sm" className="flex-1 text-[11px] font-black uppercase tracking-widest h-11 rounded-xl" onClick={() => handleTaskSelect(task.id)}>
                             <MapIcon className="h-4 w-4 mr-2" /> Track
                           </Button>
                         </CardFooter>
                       </Card>
                     ))}
                   </div>
                 </TabsContent>
                 
                 <TabsContent value="personnel" className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {sortedVolunteers.map(volunteer => (
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
             ) : (
               <Tabs defaultValue="nearby" className="space-y-8">
                 <TabsList className="grid w-full grid-cols-2 max-w-sm h-12 bg-muted p-1 rounded-xl">
                   <TabsTrigger value="nearby" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Nearby Relief</TabsTrigger>
                   <TabsTrigger value="assignments" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Missions</TabsTrigger>
                 </TabsList>

                 <TabsContent value="nearby" className="space-y-6">
                   {!userLocation ? (
                     <div className="py-24 text-center bg-card rounded-[3rem] border-2 border-dashed">
                       <Navigation className="h-16 w-16 text-muted-foreground/20 mx-auto mb-6" />
                       <h3 className="text-2xl font-black text-muted-foreground uppercase tracking-tighter">Position Not Verified</h3>
                       <p className="text-sm text-muted-foreground mt-3 font-semibold max-w-sm mx-auto">Verify your coordinates to see humanitarian needs in your immediate sector.</p>
                       <Button onClick={handleLocateMe} className="mt-8 rounded-xl font-black uppercase tracking-widest px-8">Sync Location</Button>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                       {nearbyOpportunities.map(task => (
                         <Card key={task.id} className="border-2 shadow-lg bg-card rounded-3xl overflow-hidden flex flex-col hover:shadow-2xl transition-all">
                           <div className="p-3 bg-primary/5 border-b flex justify-between items-center px-6">
                              <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <LocateFixed className="h-4 w-4" /> {task.distance.toFixed(1)}km Away
                              </span>
                              <Badge variant="outline" className="text-[9px] font-black uppercase border-2">{task.urgency}</Badge>
                           </div>
                           <CardHeader className="pb-4">
                             <CardTitle className="text-xl font-black text-foreground">{task.title}</CardTitle>
                             <CardDescription className="font-bold text-muted-foreground">{task.category} • {task.location}</CardDescription>
                           </CardHeader>
                           <CardContent className="space-y-4 flex-grow">
                             <p className="text-sm text-muted-foreground leading-relaxed italic line-clamp-2">"{task.description}"</p>
                             <div className="flex flex-wrap gap-2">
                               {task.skillsRequired.map((s, i) => (
                                 <Badge key={i} variant="secondary" className="text-[9px] font-bold px-2 rounded-lg">{s}</Badge>
                               ))}
                             </div>
                           </CardContent>
                           <CardFooter className="pt-4 border-t bg-muted/10 p-4">
                             <Button className="w-full h-11 gap-2 font-black uppercase text-[10px] tracking-widest rounded-xl" onClick={() => handleTaskSelect(task.id)}>
                               <Route className="h-4 w-4" /> Secure Path
                             </Button>
                           </CardFooter>
                         </Card>
                       ))}
                     </div>
                   )}
                 </TabsContent>

                 <TabsContent value="assignments" className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {myAssignments.length > 0 ? (
                       myAssignments.map(task => (
                         <Card key={task.id} className="border-2 shadow-xl border-emerald-500/20 bg-emerald-500/[0.02] rounded-3xl overflow-hidden flex flex-col">
                           <CardHeader className="pb-4">
                             <div className="flex justify-between items-start mb-2">
                               <Badge className="bg-emerald-500 text-white font-black uppercase text-[9px]">In Progress</Badge>
                               <span className="text-[10px] font-bold text-muted-foreground uppercase">{task.location}</span>
                             </div>
                             <CardTitle className="text-xl font-black text-foreground">{task.title}</CardTitle>
                           </CardHeader>
                           <CardContent className="flex-grow">
                             <p className="text-sm text-muted-foreground italic">Your tactical assignment for this mission is active. Report status updates to HQ.</p>
                           </CardContent>
                           <CardFooter className="pt-4 border-t bg-emerald-500/5 p-4 flex gap-2">
                             <Button variant="default" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl text-[10px] font-black uppercase" onClick={() => handleMarkAsCompleted(task.id)}>
                               <CheckCircle2 className="h-4 w-4 mr-2" /> Mission Complete
                             </Button>
                             <Button variant="outline" className="flex-1 border-emerald-500/30 text-emerald-700 h-11 rounded-xl text-[10px] font-black uppercase" onClick={() => handleTaskSelect(task.id)}>
                               <MapIcon className="h-4 w-4 mr-2" /> Navigate
                             </Button>
                           </CardFooter>
                         </Card>
                       ))
                     ) : (
                       <div className="py-24 text-center bg-card rounded-[3rem] border-2 border-dashed">
                         <ClipboardList className="h-16 w-16 text-muted-foreground/20 mx-auto mb-6" />
                         <h3 className="text-2xl font-black text-muted-foreground uppercase tracking-tighter">No Active Assignments</h3>
                         <p className="text-sm text-muted-foreground mt-3 font-semibold max-w-sm mx-auto">Explore nearby relief opportunities or wait for HQ tactical deployment.</p>
                       </div>
                     )}
                   </div>
                 </TabsContent>
               </Tabs>
             )}
          </div>

          <aside className="lg:col-span-3 space-y-8">
            <Card className="shadow-2xl border-2 bg-primary/[0.02] rounded-[2rem] overflow-hidden">
              <CardHeader className="pb-4 bg-primary/5 border-b-2">
                <CardTitle className="text-xs font-black flex items-center gap-3 uppercase tracking-[0.2em] text-primary">
                  <BarChart3 className="h-5 w-5" /> Operational Data
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8 space-y-8">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={areaImpact} layout="vertical" margin={{ left: -10 }} onClick={(data) => { if (data.activeLabel) handleRegionClick(data.activeLabel); }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[10px] font-black uppercase text-muted-foreground" />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="tasks" radius={[0, 8, 8, 0]}>
                      {areaImpact.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                
                <div className="space-y-3">
                  <Button variant={locationFilter === 'all' ? 'default' : 'outline'} size="sm" className="w-full justify-start text-[11px] h-12 font-black uppercase tracking-widest rounded-xl border-2" onClick={() => handleRegionClick('all')}>
                    <Activity className="h-4 w-4 mr-3" /> Full Grid View
                  </Button>
                  {areaImpact.map((area) => (
                    <Button key={area.name} variant={locationFilter === area.name ? 'secondary' : 'ghost'} size="sm" className="w-full justify-between text-[11px] h-12 font-black uppercase tracking-widest rounded-xl border-2 group transition-all" onClick={() => handleRegionClick(area.name)}>
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
                   Live Activity Feed
                 </CardTitle>
               </CardHeader>
               <CardContent className="pt-6 px-6 pb-8 space-y-4">
                  {activitiesLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : activities && activities.length > 0 ? (
                    activities.map(act => (
                      <div key={act.id} className="p-4 bg-card rounded-xl border-l-4 shadow-sm text-[11px] leading-relaxed relative overflow-hidden group border-primary/20">
                         <div className={cn("absolute top-0 left-0 bottom-0 w-1", 
                            act.type === 'new_task' ? "bg-primary" : 
                            act.type === 'assigned' ? "bg-amber-500" : "bg-emerald-500")} 
                         />
                         <p className="font-bold text-foreground">{act.message}</p>
                         <p className="text-[9px] text-muted-foreground mt-1 uppercase font-black">{act.timestamp?.toMillis ? new Date(act.timestamp.toMillis()).toLocaleTimeString() : 'Just now'}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-[10px] font-black uppercase text-muted-foreground opacity-50">Grid Quiet. No activities reported.</div>
                  )}
               </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
