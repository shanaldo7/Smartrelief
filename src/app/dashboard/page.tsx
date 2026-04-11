"use client"

import { useState, useMemo, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, serverTimestamp, doc, query, orderBy, limit } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Zap, AlertTriangle, Activity, Loader2, BarChart3, Map as MapIcon, CheckCircle, Navigation, ShieldCheck, Briefcase, UserCircle, FilterX, Target, LocateFixed, Route, UserCheck } from "lucide-react";
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
  loading: () => <div className="h-[500px] w-full bg-muted animate-pulse rounded-[2.5rem] flex items-center justify-center text-muted-foreground border-4 border-dashed font-black uppercase tracking-[0.3em] text-xs">Initializing Satellite Link...</div>
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

const chartConfig = {
  tasks: {
    label: "Needs Count",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function Dashboard() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [simulationRole, setSimulationRole] = useState<"ngo" | "volunteer">("ngo");
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

  const matches = useMemo(() => {
    if (!rawTasks || !rawVolunteers) return [];
    const results: Match[] = [];
    rawTasks.filter(t => t.status === 'open').forEach(task => {
      rawVolunteers.forEach(volunteer => {
        const dist = getDistance(task.latitude, task.longitude, volunteer.latitude, volunteer.longitude);
        let score = 0;
        const proximityScore = Math.max(0, 150 - (dist / 2)); 
        score += proximityScore;
        const matchedSkills = task.skillsRequired.filter(skill => 
          volunteer.skills.some(vSkill => vSkill.toLowerCase() === skill.toLowerCase())
        );
        if (matchedSkills.length > 0) score += matchedSkills.length * 40;
        score += (task.priority * 20);

        if (score > 60) {
          results.push({
            taskId: task.id,
            volunteerId: volunteer.id,
            score: Math.round(score),
            reasons: matchedSkills.length > 0 ? [`${matchedSkills.length} Skills Match`] : ["Proximity Match"],
            taskTitle: task.title,
            volunteerName: volunteer.name,
            location: task.location,
            distance: dist.toFixed(1)
          });
        }
      });
    });
    return results.sort((a, b) => b.score - a.score);
  }, [rawTasks, rawVolunteers]);

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
        setMapZoom(14);
      }
    }
  }, [rawTasks]);

  const handleFocusEmergency = useCallback(() => {
    if (!rawTasks) return;
    const criticalTask = [...rawTasks]
      .filter(t => t.status === 'open')
      .sort((a, b) => b.priority - a.priority)[0];

    if (criticalTask) {
      handleTaskSelect(criticalTask.id);
      toast({ title: "Focus Locked", description: `Critical emergency detected: ${criticalTask.title}` });
    }
  }, [rawTasks, handleTaskSelect, toast]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setMapZoom(13);
        setIsLocating(false);
        toast({ title: "Position Verified", description: "Your coordinates have been pinned." });
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  }, [toast]);

  const handleAssignVolunteer = useCallback((taskId: string, volunteerName: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "assigned",
      assignedTo: volunteerName,
      updatedAt: serverTimestamp(),
    });
    logActivity("assigned", `${volunteerName} deployed to ${task?.title || 'task'}`);
    toast({ title: "Responder Deployed", description: `${volunteerName} is en route.` });
  }, [db, toast, rawTasks, logActivity]);

  const handleMarkAsCompleted = useCallback((taskId: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "completed",
      updatedAt: serverTimestamp(),
    });
    logActivity("completed", `Mission Success: ${task?.title}`);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    toast({ title: "Mission Successful", description: "Task removed from tactical grid." });
  }, [db, selectedTaskId, toast, rawTasks, logActivity]);

  if (isUserLoading || tasksLoading || volunteersLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Navbar />
      <main className="container mx-auto px-4 py-10 max-w-[1600px]">
        <header className="mb-12 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 border-b-4 border-primary pb-10">
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none flex items-center gap-4">
              <ShieldCheck className="h-12 w-12 text-primary" />
              Command Center
            </h1>
            <div className="flex items-center gap-4">
              <span className="w-3 h-3 rounded-full bg-accent animate-pulse" />
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                Operational Status: <span className="text-primary">Tactical Sync Active</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="bg-muted p-1.5 rounded-[1.5rem] flex gap-2 border-2 shadow-inner">
              <Button 
                variant={simulationRole === 'ngo' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-black uppercase text-[11px] tracking-widest px-8 h-12 transition-all", simulationRole === 'ngo' && "shadow-xl")}
                onClick={() => setSimulationRole('ngo')}
              >
                <Briefcase className="h-4 w-4 mr-2" /> NGO Panel
              </Button>
              <Button 
                variant={simulationRole === 'volunteer' ? 'default' : 'ghost'} 
                className={cn("rounded-xl font-black uppercase text-[11px] tracking-widest px-8 h-12 transition-all", simulationRole === 'volunteer' && "shadow-xl")}
                onClick={() => setSimulationRole('volunteer')}
              >
                <UserCircle className="h-4 w-4 mr-2" /> Volunteer Panel
              </Button>
            </div>
            
            <div className="flex gap-4">
              <Button 
                className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest shadow-2xl bg-destructive hover:bg-destructive/90 text-white gap-3 animate-bounce" 
                onClick={handleFocusEmergency}
              >
                <AlertTriangle className="h-6 w-6" />
                🚨 Focus Emergency
              </Button>
              <Button 
                variant="outline" 
                className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest border-4 gap-3" 
                onClick={handleLocateMe}
                disabled={isLocating}
              >
                <Navigation className={cn("h-6 w-6", isLocating && "animate-pulse")} />
                {isLocating ? "Syncing..." : "Detect Position"}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-9 space-y-10">
            {/* Tactical Filter System */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 bg-card p-6 rounded-[2.5rem] border-4 shadow-xl">
               <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Relief Sector</p>
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="rounded-xl h-12 border-2"><SelectValue placeholder="Category" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Sectors</SelectItem>
                     <SelectItem value="Food">Food & Nutrition</SelectItem>
                     <SelectItem value="Medical">Medical Support</SelectItem>
                     <SelectItem value="Logistics">Supply Chain</SelectItem>
                     <SelectItem value="Teaching">Education</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <p className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Urgency Rank</p>
                 <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                   <SelectTrigger className="rounded-xl h-12 border-2"><SelectValue placeholder="Urgency" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Levels</SelectItem>
                     <SelectItem value="high">Critical Only</SelectItem>
                     <SelectItem value="medium">Medium Priority</SelectItem>
                     <SelectItem value="low">Standard Care</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="flex items-end">
                 <Button variant="ghost" className="w-full rounded-xl font-black uppercase text-[10px] tracking-[0.2em] h-12 border-4 border-dashed" onClick={() => { setCategoryFilter('all'); setUrgencyFilter('all'); setLocationFilter('all'); }}>
                   <FilterX className="h-5 w-5 mr-3" /> Reset Operational Filter
                 </Button>
               </div>
            </div>

            <Card className="border-4 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden h-[600px] relative bg-card rounded-[3rem]">
              <InteractiveMap 
                tasks={activeTasksForMap} 
                volunteers={rawVolunteers || []} 
                center={mapCenter} 
                zoom={mapZoom}
                userLocation={userLocation}
                selectedTaskId={selectedTaskId}
                onTaskSelect={handleTaskSelect}
              />
              <div className="absolute bottom-10 left-10 z-[1000] flex gap-4">
                <div className="glass p-6 rounded-[2rem] flex flex-col gap-4 min-w-[220px]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">Tactical Indicators</h4>
                  <div className="flex items-center gap-3 text-xs font-black uppercase">
                    <div className="w-4 h-4 rounded-full bg-destructive border-2 border-white" /> Emergency Crisis
                  </div>
                  <div className="flex items-center gap-3 text-xs font-black uppercase">
                    <div className="w-4 h-4 rounded-full bg-primary border-2 border-white" /> Active Responder
                  </div>
                  <div className="flex items-center gap-3 text-xs font-black uppercase">
                    <div className="w-4 h-4 rounded-full bg-accent border-2 border-white" /> Verified Site
                  </div>
                </div>
              </div>
            </Card>

            {simulationRole === 'ngo' ? (
              <Tabs defaultValue="matches" className="space-y-10">
                <TabsList className="flex w-fit bg-muted p-1.5 rounded-2xl h-14 border-2 shadow-inner">
                  <TabsTrigger value="matches" className="rounded-xl font-black uppercase text-[11px] tracking-widest px-8 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl">Smart Deployment</TabsTrigger>
                  <TabsTrigger value="missions" className="rounded-xl font-black uppercase text-[11px] tracking-widest px-8 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl">Active Grid</TabsTrigger>
                  <TabsTrigger value="personnel" className="rounded-xl font-black uppercase text-[11px] tracking-widest px-8 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl">Responders</TabsTrigger>
                </TabsList>

                <TabsContent value="matches" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {matches.slice(0, 9).map((match) => (
                    <Card key={`${match.taskId}-${match.volunteerId}`} className="border-4 shadow-lg hover:shadow-2xl transition-all group rounded-[2.5rem] overflow-hidden flex flex-col bg-card">
                      <div className="h-3 bg-primary/20 group-hover:bg-primary transition-colors" />
                      <CardHeader className="pb-4">
                         <div className="flex justify-between items-start">
                           <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-2 py-1 px-4">{match.distance}KM Away</Badge>
                           <Target className="h-6 w-6 text-primary" />
                         </div>
                         <CardTitle className="text-2xl font-black leading-tight mt-4">Tactical Match</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 flex-grow">
                        <div className="p-5 bg-muted rounded-[1.5rem] border-l-8 border-destructive">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Target Mission</p>
                          <p className="font-black text-sm text-foreground uppercase">{match.taskTitle}</p>
                        </div>
                        <div className="p-5 bg-primary/5 rounded-[1.5rem] border-l-8 border-primary">
                          <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] mb-1">Assigned Personnel</p>
                          <p className="font-black text-sm text-foreground uppercase">{match.volunteerName}</p>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-6 border-t bg-muted/20">
                         <Button className="w-full h-14 font-black uppercase text-[12px] tracking-widest rounded-2xl gap-3 shadow-xl" onClick={() => handleAssignVolunteer(match.taskId, match.volunteerName)}>
                           <UserCheck className="h-5 w-5" /> Deploy Force
                         </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="missions" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredTasks.map(task => (
                    <Card key={task.id} className={cn("border-4 shadow-md bg-card rounded-[2.5rem] overflow-hidden group", task.status === 'completed' && "opacity-40 grayscale")}>
                      <CardHeader className="pb-6">
                        <div className="flex justify-between items-center mb-4">
                          <Badge className={cn("text-[10px] uppercase font-black tracking-widest px-4 py-2 rounded-xl", 
                            task.urgency === 'high' ? "bg-destructive text-white" : "bg-primary text-white")}>
                            {task.urgency}
                          </Badge>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                             <MapPin className="h-4 w-4 text-primary" /> {task.location}
                          </span>
                        </div>
                        <CardTitle className="text-2xl font-black leading-tight group-hover:text-primary transition-colors">{task.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed font-bold italic">"{task.description}"</p>
                        {task.assignedTo && (
                          <div className="pt-4 border-t flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-accent" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Active: {task.assignedTo}</span>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-6 border-t flex gap-4 bg-muted/10">
                         {task.status !== 'completed' && (
                           <Button variant="ghost" className="flex-1 h-12 text-[11px] font-black uppercase tracking-widest rounded-xl" onClick={() => handleMarkAsCompleted(task.id)}>
                             <CheckCircle className="h-4 w-4 mr-2" /> Complete
                           </Button>
                         )}
                         <Button variant="outline" className="flex-1 h-12 text-[11px] font-black uppercase tracking-widest rounded-xl border-4" onClick={() => handleTaskSelect(task.id)}>
                           <MapIcon className="h-4 w-4 mr-2" /> Track Site
                         </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            ) : (
              <Tabs defaultValue="nearby" className="space-y-10">
                 <TabsList className="flex w-fit bg-muted p-1.5 rounded-2xl h-14 border-2 shadow-inner">
                   <TabsTrigger value="nearby" className="rounded-xl font-black uppercase text-[11px] tracking-widest px-8 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl">Nearby Threats</TabsTrigger>
                   <TabsTrigger value="assignments" className="rounded-xl font-black uppercase text-[11px] tracking-widest px-8 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-xl">My Missions</TabsTrigger>
                 </TabsList>

                 <TabsContent value="nearby">
                   {!userLocation ? (
                     <Card className="border-4 border-dashed py-32 text-center bg-card rounded-[3rem] shadow-2xl">
                       <Navigation className="h-20 w-20 text-muted-foreground/20 mx-auto mb-8 animate-pulse" />
                       <h3 className="text-4xl font-black text-foreground uppercase tracking-tighter mb-4">Location Not Synced</h3>
                       <p className="text-xl text-muted-foreground font-bold italic max-w-lg mx-auto mb-10">Verify your current coordinates to see real-time humanitarian needs in your sector.</p>
                       <Button onClick={handleLocateMe} className="h-16 px-12 rounded-[1.5rem] font-black uppercase text-lg tracking-widest shadow-2xl">Sync Tactical Position</Button>
                     </Card>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                       {nearbyOpportunities.map(task => (
                         <Card key={task.id} className="border-4 shadow-xl bg-card rounded-[2.5rem] overflow-hidden flex flex-col hover:scale-[1.02] transition-transform">
                            <div className="p-4 bg-primary/10 border-b-4 flex justify-between items-center px-8">
                               <span className="text-[11px] font-black uppercase text-primary tracking-widest flex items-center gap-3">
                                 <LocateFixed className="h-5 w-5" /> {task.distance.toFixed(1)}KM FROM YOU
                               </span>
                               <Badge className="bg-accent text-white font-black uppercase text-[9px] py-1 px-3">Active Crisis</Badge>
                            </div>
                            <CardHeader className="pb-4">
                              <CardTitle className="text-2xl font-black text-foreground uppercase">{task.title}</CardTitle>
                              <CardDescription className="font-black text-muted-foreground tracking-widest">{task.category} • {task.location}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 flex-grow">
                               <p className="text-sm text-muted-foreground leading-relaxed italic font-bold">"{task.description}"</p>
                               <div className="flex flex-wrap gap-2">
                                 {task.skillsRequired.map((s, i) => (
                                   <Badge key={i} variant="secondary" className="text-[10px] font-black uppercase py-1 px-3 border-2">{s}</Badge>
                                 ))}
                               </div>
                            </CardContent>
                            <CardFooter className="pt-6 border-t p-6 bg-muted/10">
                               <Button className="w-full h-14 gap-4 font-black uppercase text-[12px] tracking-widest rounded-2xl shadow-xl" onClick={() => handleTaskSelect(task.id)}>
                                 <Route className="h-6 w-6" /> Calculate Route
                               </Button>
                            </CardFooter>
                         </Card>
                       ))}
                     </div>
                   )}
                 </TabsContent>
              </Tabs>
            )}
          </div>

          <aside className="lg:col-span-3 space-y-10">
            {/* Live Activity Feed */}
            <Card className="shadow-2xl border-4 bg-card rounded-[2.5rem] overflow-hidden">
               <CardHeader className="bg-primary/5 border-b-4 p-8">
                 <CardTitle className="text-lg font-black flex items-center gap-4 text-primary uppercase tracking-[0.2em]">
                   <Activity className="h-6 w-6 text-accent" />
                   Operational Feed
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                 {activitiesLoading ? (
                   <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                 ) : activities && activities.length > 0 ? (
                   activities.map(act => (
                     <div key={act.id} className="p-5 bg-muted rounded-2xl border-l-8 border-primary relative overflow-hidden group hover:bg-muted/80 transition-all">
                        <div className={cn("absolute top-0 right-0 w-2 h-full", 
                           act.type === 'new_task' ? "bg-primary" : 
                           act.type === 'assigned' ? "bg-accent" : "bg-emerald-500")} />
                        <p className="font-black text-foreground text-xs leading-tight uppercase mb-2">{act.message}</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">
                          {act.timestamp?.toMillis ? new Date(act.timestamp.toMillis()).toLocaleTimeString() : 'SYNCHRONIZING...'}
                        </p>
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-10 text-xs font-black uppercase text-muted-foreground opacity-50 tracking-[0.3em]">Grid Silence.</div>
                 )}
               </CardContent>
            </Card>

            <Card className="shadow-2xl border-4 bg-primary/[0.02] rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 bg-muted/50 border-b-4">
                <CardTitle className="text-xs font-black flex items-center gap-4 uppercase tracking-[0.3em] text-primary">
                  <BarChart3 className="h-6 w-6" /> Sector Impact
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={areaImpact} layout="vertical" margin={{ left: -10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[10px] font-black uppercase text-muted-foreground" width={80} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="tasks" radius={[0, 10, 10, 0]} fill="hsl(var(--primary))">
                      {areaImpact.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}