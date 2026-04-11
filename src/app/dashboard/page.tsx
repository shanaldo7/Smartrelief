
"use client"

import { useState, useMemo, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, serverTimestamp, doc, query, orderBy, limit, deleteField, setDoc } from "firebase/firestore";
import { MapPin, AlertTriangle, Activity, Loader2, BarChart3, Navigation, ShieldCheck, FilterX, Target, LocateFixed, Route, UserCheck, UserMinus, XCircle, RotateCcw } from "lucide-react";
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
  loading: () => <div className="h-[500px] w-full bg-muted animate-pulse rounded-3xl flex items-center justify-center text-muted-foreground border-2 border-dashed font-bold uppercase tracking-widest text-[10px] italic">Initializing Strategic Feed...</div>
});

const EMPTY_ARRAY: any[] = [];
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

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
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
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
    if (!rawTasks) return EMPTY_ARRAY;
    return rawTasks.filter(t => t.status !== 'completed');
  }, [rawTasks]);

  const filteredTasks = useMemo(() => {
    if (!rawTasks) return EMPTY_ARRAY;
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
    if (!rawTasks || !rawVolunteers) return EMPTY_ARRAY;
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
    if (!userLocation || !rawTasks) return EMPTY_ARRAY;
    return rawTasks
      .filter(t => t.status === 'open')
      .map(t => ({
        ...t,
        distance: getDistance(userLocation[0], userLocation[1], t.latitude, t.longitude)
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [userLocation, rawTasks]);

  const areaImpact = useMemo(() => {
    if (!rawTasks) return EMPTY_ARRAY;
    const counts: Record<string, number> = {};
    rawTasks.filter(t => t.status === 'open').forEach(t => {
      counts[t.location] = (counts[t.location] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, tasks: count }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [rawTasks]);

  const logActivity = useCallback((type: "new_task" | "assigned" | "completed", message: string) => {
    if (!db) return;
    const actRef = doc(collection(db, "activities"));
    setDoc(actRef, {
      id: actRef.id,
      type,
      message,
      timestamp: serverTimestamp()
    });
  }, [db]);

  const updateMapFocus = useCallback((lat: number, lng: number, zoom: number) => {
    setMapCenter(prev => {
      if (Math.abs(prev[0] - lat) < 0.0001 && Math.abs(prev[1] - lng) < 0.0001) return prev;
      return [lat, lng];
    });
    setMapZoom(prev => prev === zoom ? prev : zoom);
  }, []);

  const handleTaskSelect = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    if (taskId) {
      const task = rawTasks?.find(t => t.id === taskId);
      if (task && task.latitude) {
        updateMapFocus(task.latitude, task.longitude, 14);
      }
    }
  }, [rawTasks, updateMapFocus]);

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

  const handleResetFilters = useCallback(() => {
    setCategoryFilter('all');
    setUrgencyFilter('all');
    setLocationFilter('all');
    toast({ title: "Filters Cleared", description: "Showing all strategic humanitarian data." });
  }, [toast]);

  const handleResetTacticalView = useCallback(() => {
    setSelectedTaskId(null);
    setMapCenter(DEFAULT_CENTER);
    setMapZoom(DEFAULT_ZOOM);
    toast({ title: "Tactical Reset", description: "Map view returned to neutral global overview." });
  }, [toast]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        updateMapFocus(latitude, longitude, 13);
        setIsLocating(false);
        toast({ title: "Position Verified", description: "Your coordinates have been pinned." });
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true }
    );
  }, [toast, updateMapFocus]);

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

  const handleRemoveResponder = useCallback((taskId: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "open",
      assignedTo: deleteField(),
      updatedAt: serverTimestamp(),
    });
    logActivity("completed", `Personnel recalled from: ${task?.title}`);
    toast({ title: "Responder Recalled", description: "Mission status reverted to open." });
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
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1400px]">
        <header className="mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b pb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase leading-none">
                Command Hub
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Network: <span className="text-primary">Sync Active</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-muted p-1 rounded-lg flex gap-1 border">
              <Button 
                variant={simulationRole === 'ngo' ? 'default' : 'ghost'} 
                size="sm"
                className={cn("rounded-md font-bold uppercase text-[9px] tracking-widest px-3 h-8", simulationRole === 'ngo' && "shadow-sm")}
                onClick={() => setSimulationRole('ngo')}
              >
                NGO Control
              </Button>
              <Button 
                variant={simulationRole === 'volunteer' ? 'default' : 'ghost'} 
                size="sm"
                className={cn("rounded-md font-bold uppercase text-[9px] tracking-widest px-3 h-8", simulationRole === 'volunteer' && "shadow-sm")}
                onClick={() => setSimulationRole('volunteer')}
              >
                Responder
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="destructive"
                className="h-8 px-3 rounded-md font-bold uppercase tracking-widest gap-2 text-[9px]" 
                onClick={handleFocusEmergency}
              >
                <AlertTriangle className="h-3 w-3" />
                Emergency Focus
              </Button>
              <Button 
                variant="outline" 
                className="h-8 px-3 rounded-md font-bold uppercase tracking-widest border-2 gap-2 text-[9px]" 
                onClick={handleResetTacticalView}
              >
                <RotateCcw className="h-3 w-3" />
                Reset View
              </Button>
              <Button 
                variant="secondary" 
                className="h-8 px-3 rounded-md font-bold uppercase tracking-widest gap-2 text-[9px]" 
                onClick={handleLocateMe}
                disabled={isLocating}
              >
                <Navigation className={cn("h-3 w-3", isLocating && "animate-pulse")} />
                {isLocating ? "Syncing..." : "GPS Sync"}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-9 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card p-4 rounded-xl border shadow-sm items-end">
               <div className="space-y-1">
                 <Label className="text-[9px] font-bold uppercase text-muted-foreground ml-0.5">Relief Sector</Label>
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="rounded-lg h-9 border-2 text-[10px]"><SelectValue placeholder="Category" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Sectors</SelectItem>
                     <SelectItem value="Food">Food & Nutrition</SelectItem>
                     <SelectItem value="Medical">Medical Support</SelectItem>
                     <SelectItem value="Logistics">Supply Chain</SelectItem>
                     <SelectItem value="Teaching">Education</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1">
                 <Label className="text-[9px] font-bold uppercase text-muted-foreground ml-0.5">Urgency Level</Label>
                 <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                   <SelectTrigger className="rounded-lg h-9 border-2 text-[10px]"><SelectValue placeholder="Urgency" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Levels</SelectItem>
                     <SelectItem value="high">Critical Only</SelectItem>
                     <SelectItem value="medium">Medium Priority</SelectItem>
                     <SelectItem value="low">Standard Care</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Button variant="ghost" size="sm" className="w-full rounded-lg font-bold uppercase text-[9px] tracking-widest h-9 border-2 border-dashed" onClick={handleResetFilters}>
                   <FilterX className="h-3 w-3 mr-2" /> Clear All Filters
                 </Button>
               </div>
            </div>

            <Card className="border-2 shadow-lg overflow-hidden h-[500px] relative bg-card rounded-3xl">
              <InteractiveMap 
                tasks={activeTasksForMap} 
                volunteers={rawVolunteers || EMPTY_ARRAY} 
                center={mapCenter} 
                zoom={mapZoom}
                userLocation={userLocation}
                selectedTaskId={selectedTaskId}
                onTaskSelect={handleTaskSelect}
              />
              {selectedTaskId && (
                <div className="absolute top-4 left-4 z-[1000] flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="rounded-full shadow-xl font-bold uppercase text-[9px] tracking-widest h-8 bg-background/90 backdrop-blur"
                    onClick={() => setSelectedTaskId(null)}
                  >
                    <XCircle className="h-3 w-3 mr-1.5 text-destructive" />
                    Deactivate Route
                  </Button>
                </div>
              )}
            </Card>

            {simulationRole === 'ngo' ? (
              <Tabs defaultValue="matches" className="space-y-6">
                <TabsList className="bg-muted p-1 rounded-lg h-10 border">
                  <TabsTrigger value="matches" className="rounded-md font-bold uppercase text-[9px] tracking-widest px-4 data-[state=active]:bg-primary data-[state=active]:text-white">Smart Deployment</TabsTrigger>
                  <TabsTrigger value="missions" className="rounded-md font-bold uppercase text-[9px] tracking-widest px-4 data-[state=active]:bg-primary data-[state=active]:text-white">Active Grid</TabsTrigger>
                </TabsList>

                <TabsContent value="matches" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {matches.length > 0 ? matches.slice(0, 6).map((match) => (
                    <Card key={`${match.taskId}-${match.volunteerId}`} className="border-2 shadow-sm hover:shadow-md transition-all rounded-xl overflow-hidden flex flex-col">
                      <div className="h-1 bg-primary/20" />
                      <CardHeader className="p-4 pb-1">
                         <div className="flex justify-between items-start">
                           <Badge variant="outline" className="text-[8px] font-bold uppercase border-2">{match.distance}KM Range</Badge>
                           <Target className="h-4 w-4 text-primary" />
                         </div>
                         <CardTitle className="text-base font-bold mt-2 leading-tight">Match Detected</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 space-y-3 flex-grow">
                        <div className="p-2 bg-muted rounded-lg border-l-4 border-destructive">
                          <p className="text-[8px] font-bold uppercase text-muted-foreground mb-0.5">Incident</p>
                          <p className="font-bold text-[10px] uppercase truncate">{match.taskTitle}</p>
                        </div>
                        <div className="p-2 bg-primary/5 rounded-lg border-l-4 border-primary">
                          <p className="text-[8px] font-bold uppercase text-primary mb-0.5">Personnel</p>
                          <p className="font-bold text-[10px] uppercase truncate">{match.volunteerName}</p>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0">
                         <Button className="w-full h-8 font-bold uppercase text-[9px] tracking-widest rounded-lg gap-2 shadow-sm" onClick={() => handleAssignVolunteer(match.taskId, match.volunteerName)}>
                           <UserCheck className="h-3 w-3" /> Deploy Responder
                         </Button>
                      </CardFooter>
                    </Card>
                  )) : (
                    <div className="col-span-full py-16 text-center border-2 border-dashed rounded-2xl opacity-40">
                      <p className="font-bold uppercase tracking-widest text-[10px] italic">No Optimal Matches in Sector</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="missions" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTasks.map(task => (
                    <Card key={task.id} className={cn("border-2 shadow-sm bg-card rounded-xl overflow-hidden group flex flex-col h-full", task.status === 'completed' && "opacity-40 grayscale")}>
                      <CardHeader className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <Badge className={cn("text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md", 
                            task.urgency === 'high' ? "bg-destructive text-white" : "bg-primary text-white")}>
                            {task.urgency}
                          </Badge>
                          <span className="text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                             <MapPin className="h-3 w-3 text-primary" /> {task.location}
                          </span>
                        </div>
                        <CardTitle className="text-base font-bold leading-tight truncate uppercase">{task.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-3 flex-grow">
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed font-medium italic">"{task.description}"</p>
                        {task.assignedTo && (
                          <div className="pt-2 border-t flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-accent">Responder: {task.assignedTo}</span>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex flex-col gap-1.5">
                         <div className="flex w-full gap-2">
                           <Button variant="outline" size="sm" className="flex-1 h-8 text-[9px] font-bold uppercase tracking-widest rounded-md border-2" onClick={() => handleTaskSelect(task.id)}>
                             <Route className="h-3.5 w-3.5 mr-1" /> Path
                           </Button>
                           {task.status !== 'completed' && (
                             <Button variant="ghost" size="sm" className="flex-1 h-8 text-[9px] font-bold uppercase tracking-widest rounded-md border" onClick={() => handleMarkAsCompleted(task.id)}>
                               Done
                             </Button>
                           )}
                         </div>
                         {task.assignedTo && (
                           <Button variant="destructive" size="sm" className="w-full h-7 text-[8px] font-bold uppercase tracking-widest rounded-md gap-1.5" onClick={() => handleRemoveResponder(task.id)}>
                             <UserMinus className="h-3 w-3" /> Remove Responder
                           </Button>
                         )}
                      </CardFooter>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            ) : (
              <Tabs defaultValue="nearby" className="space-y-6">
                 <TabsList className="bg-muted p-1 rounded-lg h-10 border">
                   <TabsTrigger value="nearby" className="rounded-md font-bold uppercase text-[9px] tracking-widest px-4 data-[state=active]:bg-primary data-[state=active]:text-white">Nearby Missions</TabsTrigger>
                   <TabsTrigger value="assignments" className="rounded-md font-bold uppercase text-[9px] tracking-widest px-4 data-[state=active]:bg-primary data-[state=active]:text-white">My Deployments</TabsTrigger>
                 </TabsList>

                 <TabsContent value="nearby">
                   {!userLocation ? (
                     <div className="py-24 text-center border-2 border-dashed rounded-2xl bg-card shadow-inner">
                       <Navigation className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4 animate-pulse" />
                       <h3 className="text-lg font-bold text-foreground uppercase tracking-tight mb-1">GPS Sync Required</h3>
                       <p className="text-[10px] text-muted-foreground font-medium italic max-w-sm mx-auto mb-6">Sync tactical position to view local missions.</p>
                       <Button onClick={handleLocateMe} className="h-10 px-6 rounded-lg font-bold uppercase text-[10px] tracking-widest shadow-lg">Sync GPS</Button>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                       {nearbyOpportunities.map(task => (
                         <Card key={task.id} className="border-2 shadow-sm bg-card rounded-xl overflow-hidden flex flex-col hover:border-primary transition-colors">
                            <div className="p-2 bg-primary/5 border-b flex justify-between items-center px-4">
                               <span className="text-[9px] font-bold uppercase text-primary tracking-widest flex items-center gap-1.5">
                                 <LocateFixed className="h-3.5 w-3.5" /> {task.distance.toFixed(1)}KM
                               </span>
                               <Badge className="bg-accent text-white font-bold uppercase text-[7px] py-0 px-1.5">Live</Badge>
                            </div>
                            <CardHeader className="p-4 pb-1">
                              <CardTitle className="text-base font-bold uppercase truncate">{task.title}</CardTitle>
                              <CardDescription className="font-bold text-[8px] text-muted-foreground tracking-widest uppercase mt-0.5">{task.category} • {task.location}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-1 space-y-3 flex-grow">
                               <p className="text-[10px] text-muted-foreground leading-relaxed italic font-medium line-clamp-2">"{task.description}"</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {task.skillsRequired.map((s, i) => (
                                   <Badge key={i} variant="secondary" className="text-[7px] font-bold uppercase py-0 px-1.5 border">{s}</Badge>
                                 ))}
                               </div>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                               <Button className="w-full h-9 gap-2 font-bold uppercase text-[9px] tracking-widest rounded-lg shadow-sm" onClick={() => handleTaskSelect(task.id)}>
                                 <Route className="h-3.5 w-3.5" /> Plot Path
                               </Button>
                            </CardFooter>
                         </Card>
                       ))}
                     </div>
                   )}
                 </TabsContent>

                 <TabsContent value="assignments">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {rawTasks?.filter(t => t.assignedTo && (t.assignedTo === user?.displayName || t.assignedTo === 'Anonymous')).map(task => (
                        <Card key={task.id} className="border-2 rounded-xl overflow-hidden">
                           <CardHeader className="p-5">
                             <div className="flex justify-between items-center mb-3">
                               <Badge className="bg-accent text-white uppercase text-[8px] font-bold tracking-widest">Active Mission</Badge>
                               <span className="text-[9px] font-bold uppercase text-muted-foreground">{task.location}</span>
                             </div>
                             <CardTitle className="text-lg font-bold uppercase">{task.title}</CardTitle>
                           </CardHeader>
                           <CardContent className="px-5 pb-5">
                             <p className="text-[11px] text-muted-foreground italic mb-4">"{task.description}"</p>
                             <Button className="w-full h-10 rounded-lg font-bold uppercase text-[10px] tracking-widest gap-2" onClick={() => handleTaskSelect(task.id)}>
                               <Route className="h-4 w-4" /> Tactical Path
                             </Button>
                           </CardContent>
                        </Card>
                      ))}
                    </div>
                 </TabsContent>
              </Tabs>
            )}
          </div>

          <aside className="lg:col-span-3 space-y-6">
            <Card className="shadow-lg border-2 bg-card rounded-2xl overflow-hidden">
               <CardHeader className="bg-muted/30 border-b p-4">
                 <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-primary uppercase tracking-widest">
                   <Activity className="h-4 w-4 text-accent" />
                   Tactical Feed
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-4 space-y-3">
                 {activitiesLoading ? (
                   <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                 ) : activities && activities.length > 0 ? (
                   activities.map(act => (
                     <div key={act.id} className="p-3 bg-muted/50 rounded-lg border-l-4 border-primary relative overflow-hidden group hover:bg-muted transition-colors">
                        <div className={cn("absolute top-0 right-0 w-1 h-full opacity-50", 
                           act.type === 'new_task' ? "bg-primary" : 
                           act.type === 'assigned' ? "bg-accent" : "bg-emerald-500")} />
                        <p className="font-bold text-foreground text-[9px] leading-tight uppercase mb-0.5">{act.message}</p>
                        <p className="text-[7px] text-muted-foreground uppercase font-bold tracking-tight">
                          {act.timestamp?.toMillis ? new Date(act.timestamp.toMillis()).toLocaleTimeString() : 'SYNCING'}
                        </p>
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-4 text-[9px] font-bold uppercase text-muted-foreground opacity-30 tracking-widest italic">Monitoring Grid...</div>
                 )}
               </CardContent>
            </Card>

            <Card className="shadow-lg border-2 bg-card rounded-2xl overflow-hidden">
              <CardHeader className="p-4 bg-muted/30 border-b">
                <CardTitle className="text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest text-primary">
                  <BarChart3 className="h-4 w-4" /> Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={areaImpact} layout="vertical" margin={{ left: -20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[8px] font-bold uppercase text-muted-foreground" width={60} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="tasks" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))">
                      {areaImpact.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"} />
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
