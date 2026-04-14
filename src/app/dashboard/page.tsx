
"use client"

import { useState, useMemo, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, serverTimestamp, doc, query, orderBy, limit, deleteField, setDoc } from "firebase/firestore";
import { MapPin, AlertTriangle, Activity, Loader2, BarChart3, Navigation, ShieldCheck, FilterX, Target, LocateFixed, Route, UserCheck, UserMinus, XCircle, RotateCcw, Briefcase, Clock, Users, DollarSign } from "lucide-react";
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
  status: "open" | "assigned" | "completed";
  submittedBy: string;
  assignedTo?: string;
  assignedVolunteerId?: string;
  isPaid?: boolean;
  workDuration?: string;
  startTime?: any;
  endTime?: any;
  createdAt?: any;
}

interface Volunteer {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  skills: string[];
  status: "available" | "busy";
  currentAssignment?: {
    ngoName: string;
    role: string;
    workDuration: string;
    isPaid: boolean;
  };
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
  type: string;
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

  // Workforce Assignment State
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentParams, setAssignmentParams] = useState({
    isPaid: false,
    duration: "1",
    unit: "days",
    role: ""
  });

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
    return query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(15));
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

  const availableVolunteers = useMemo(() => {
    if (!rawVolunteers) return EMPTY_ARRAY;
    return rawVolunteers.filter(v => v.status === 'available');
  }, [rawVolunteers]);

  const matches = useMemo(() => {
    if (!rawTasks || !availableVolunteers) return EMPTY_ARRAY;
    const results: Match[] = [];
    rawTasks.filter(t => t.status === 'open').forEach(task => {
      availableVolunteers.forEach(volunteer => {
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
  }, [rawTasks, availableVolunteers]);

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

  const logActivity = useCallback((type: string, message: string) => {
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

  const handleHireVolunteer = useCallback((taskId: string, volunteerId: string, volunteerName: string) => {
    if (!db || !user) return;
    const task = rawTasks?.find(t => t.id === taskId);
    const durationStr = `${assignmentParams.duration} ${assignmentParams.unit}`;
    
    // 1. Update Task
    updateDocumentNonBlocking(doc(db, "tasks", taskId), {
      status: "assigned",
      assignedTo: volunteerName,
      assignedVolunteerId: volunteerId,
      isPaid: assignmentParams.isPaid,
      workDuration: durationStr,
      startTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 2. Update Volunteer Profile (Lock status)
    updateDocumentNonBlocking(doc(db, "volunteerProfiles", volunteerId), {
      status: "busy",
      currentAssignment: {
        ngoId: user.uid,
        ngoName: user.displayName || "Partner NGO",
        role: assignmentParams.role || task?.category || "Specialist",
        workDuration: durationStr,
        isPaid: assignmentParams.isPaid,
        taskId: taskId,
        startTime: serverTimestamp()
      }
    });

    logActivity("hired", `${volunteerName} hired by ${user.displayName || 'NGO'} for ${task?.title}`);
    toast({ title: "Workforce Deployed", description: `${volunteerName} assignment active for ${durationStr}.` });
    setIsAssigning(false);
  }, [db, user, rawTasks, assignmentParams, logActivity, toast]);

  const handleRemoveResponder = useCallback((taskId: string, volunteerId?: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    
    // 1. Reset Task
    updateDocumentNonBlocking(doc(db, "tasks", taskId), {
      status: "open",
      assignedTo: deleteField(),
      assignedVolunteerId: deleteField(),
      isPaid: deleteField(),
      workDuration: deleteField(),
      updatedAt: serverTimestamp(),
    });

    // 2. Unlock Volunteer
    if (volunteerId) {
      updateDocumentNonBlocking(doc(db, "volunteerProfiles", volunteerId), {
        status: "available",
        currentAssignment: deleteField()
      });
    }

    logActivity("recalled", `Workforce recalled from: ${task?.title}`);
    toast({ title: "Tactical Reset", description: "Responder returned to available pool." });
  }, [db, rawTasks, logActivity, toast]);

  const handleMarkAsCompleted = useCallback((taskId: string, volunteerId?: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    
    updateDocumentNonBlocking(doc(db, "tasks", taskId), {
      status: "completed",
      updatedAt: serverTimestamp(),
    });

    if (volunteerId) {
      updateDocumentNonBlocking(doc(db, "volunteerProfiles", volunteerId), {
        status: "available",
        currentAssignment: deleteField()
      });
    }

    logActivity("completed", `Mission Success: ${task?.title}`);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    toast({ title: "Mission Successful", description: "Personnel released back to grid." });
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1400px]">
        <header className="mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b pb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none">
                Operational Grid
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Network Status: <span className="text-primary">Secured & Syncing</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-muted p-1 rounded-xl flex gap-1 border shadow-sm">
              <Button 
                variant={simulationRole === 'ngo' ? 'default' : 'ghost'} 
                size="sm"
                className={cn("rounded-lg font-bold uppercase text-[9px] tracking-widest px-4 h-9", simulationRole === 'ngo' && "shadow-sm")}
                onClick={() => setSimulationRole('ngo')}
              >
                NGO Control
              </Button>
              <Button 
                variant={simulationRole === 'volunteer' ? 'default' : 'ghost'} 
                size="sm"
                className={cn("rounded-lg font-bold uppercase text-[9px] tracking-widest px-4 h-9", simulationRole === 'volunteer' && "shadow-sm")}
                onClick={() => setSimulationRole('volunteer')}
              >
                Responder
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="destructive"
                className="h-9 px-4 rounded-xl font-bold uppercase tracking-widest gap-2 text-[10px] shadow-lg shadow-destructive/20" 
                onClick={handleFocusEmergency}
              >
                <AlertTriangle className="h-4 w-4" />
                🚨 Focus Emergency
              </Button>
              <Button 
                variant="outline" 
                className="h-9 px-4 rounded-xl font-bold uppercase tracking-widest border-2 gap-2 text-[10px]" 
                onClick={() => {
                  setSelectedTaskId(null);
                  setMapCenter(DEFAULT_CENTER);
                  setMapZoom(DEFAULT_ZOOM);
                  toast({ title: "Grid Reset", description: "Neutral overview restored." });
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset View
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-9 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-card p-4 rounded-2xl border shadow-sm items-end">
               <div className="space-y-1">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Relief Sector</Label>
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="rounded-xl h-10 border-2 text-[10px]"><SelectValue placeholder="Category" /></SelectTrigger>
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
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Urgency Level</Label>
                 <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                   <SelectTrigger className="rounded-xl h-10 border-2 text-[10px]"><SelectValue placeholder="Urgency" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Levels</SelectItem>
                     <SelectItem value="high">Critical / High</SelectItem>
                     <SelectItem value="medium">Medium Priority</SelectItem>
                     <SelectItem value="low">Standard Care</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Location</Label>
                 <Select value={locationFilter} onValueChange={setLocationFilter}>
                   <SelectTrigger className="rounded-xl h-10 border-2 text-[10px]"><SelectValue placeholder="All Regions" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Global View</SelectItem>
                     {Array.from(new Set(rawTasks?.map(t => t.location))).map(loc => (
                       <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Button variant="ghost" size="sm" className="w-full rounded-xl font-bold uppercase text-[9px] tracking-widest h-10 border-2 border-dashed" onClick={() => {
                   setCategoryFilter('all');
                   setUrgencyFilter('all');
                   setLocationFilter('all');
                   toast({ title: "Filters Cleared", description: "Showing complete strategic dataset." });
                 }}>
                   <FilterX className="h-4 w-4 mr-2" /> Clear All Filters
                 </Button>
               </div>
            </div>

            <Card className="border-2 shadow-2xl overflow-hidden h-[500px] relative bg-card rounded-[2.5rem]">
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
                <div className="absolute top-6 left-6 z-[1000] flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="rounded-full shadow-2xl font-bold uppercase text-[10px] tracking-widest h-10 bg-background/95 backdrop-blur border-2"
                    onClick={() => setSelectedTaskId(null)}
                  >
                    <XCircle className="h-4 w-4 mr-2 text-destructive" />
                    Deactivate Tactical Route
                  </Button>
                </div>
              )}
            </Card>

            {simulationRole === 'ngo' ? (
              <Tabs defaultValue="matches" className="space-y-6">
                <TabsList className="bg-muted p-1 rounded-xl h-12 border shadow-sm w-full sm:w-auto">
                  <TabsTrigger value="matches" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white">Smart Recruitment</TabsTrigger>
                  <TabsTrigger value="workforce" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white">Active Workforce</TabsTrigger>
                  <TabsTrigger value="transparency" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white">Transparency Grid</TabsTrigger>
                </TabsList>

                <TabsContent value="matches" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {matches.length > 0 ? matches.slice(0, 9).map((match) => (
                    <Card key={`${match.taskId}-${match.volunteerId}`} className="border-2 shadow-lg hover:shadow-xl transition-all rounded-2xl overflow-hidden flex flex-col group border-primary/10 hover:border-primary/30 bg-card">
                      <div className="h-1.5 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                      <CardHeader className="p-5 pb-2">
                         <div className="flex justify-between items-start">
                           <Badge variant="outline" className="text-[9px] font-bold uppercase border-2 px-2.5 py-1">{match.distance}KM Proximity</Badge>
                           <Target className="h-5 w-5 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                         </div>
                         <CardTitle className="text-lg font-black mt-3 leading-tight uppercase">{match.volunteerName}</CardTitle>
                         <CardDescription className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Match Score: {match.score}%</CardDescription>
                      </CardHeader>
                      <CardContent className="p-5 pt-2 space-y-4 flex-grow">
                        <div className="p-3 bg-muted rounded-xl border border-primary/5">
                          <p className="text-[8px] font-bold uppercase text-muted-foreground mb-1">Target Mission</p>
                          <p className="font-bold text-xs uppercase truncate">{match.taskTitle}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {match.reasons.map((r, i) => (
                            <Badge key={i} className="bg-accent/10 text-accent border-accent/20 text-[8px] font-bold uppercase py-1 px-2">{r}</Badge>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="p-5 pt-0">
                         <Dialog>
                           <DialogTrigger asChild>
                             <Button className="w-full h-11 font-black uppercase text-[10px] tracking-[0.1em] rounded-xl gap-2 shadow-xl hover:shadow-primary/20">
                               <Briefcase className="h-4 w-4" /> Recruit Responder
                             </Button>
                           </DialogTrigger>
                           <DialogContent className="rounded-[2rem] border-4 shadow-2xl">
                             <DialogHeader>
                               <DialogTitle className="text-2xl font-black uppercase">Mission Assignment</DialogTitle>
                               <DialogDescription className="font-medium italic">Configure workforce parameters for {match.volunteerName}.</DialogDescription>
                             </DialogHeader>
                             <div className="space-y-6 py-4">
                               <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                   <Label className="text-[10px] font-bold uppercase">Payment Mode</Label>
                                   <Select onValueChange={(v) => setAssignmentParams(p => ({...p, isPaid: v === 'paid'}))}>
                                     <SelectTrigger className="rounded-xl h-11 border-2">
                                       <SelectValue placeholder="Contract Type" />
                                     </SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="unpaid">Volunteer (Unpaid)</SelectItem>
                                       <SelectItem value="paid">Professional (Paid)</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 </div>
                                 <div className="space-y-1">
                                   <Label className="text-[10px] font-bold uppercase">Deployment Role</Label>
                                   <Input 
                                     placeholder="e.g. Field Medic" 
                                     className="rounded-xl h-11 border-2" 
                                     onChange={(e) => setAssignmentParams(p => ({...p, role: e.target.value}))}
                                   />
                                 </div>
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                   <Label className="text-[10px] font-bold uppercase">Work Duration</Label>
                                   <Input 
                                     type="number" 
                                     placeholder="Amount" 
                                     className="rounded-xl h-11 border-2" 
                                     onChange={(e) => setAssignmentParams(p => ({...p, duration: e.target.value}))}
                                   />
                                 </div>
                                 <div className="space-y-1">
                                   <Label className="text-[10px] font-bold uppercase">Time Unit</Label>
                                   <Select onValueChange={(v) => setAssignmentParams(p => ({...p, unit: v}))}>
                                     <SelectTrigger className="rounded-xl h-11 border-2">
                                       <SelectValue placeholder="Unit" />
                                     </SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="hours">Hours</SelectItem>
                                       <SelectItem value="days">Days</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 </div>
                               </div>
                             </div>
                             <DialogFooter>
                               <Button 
                                 className="w-full h-12 font-black uppercase tracking-widest rounded-xl"
                                 onClick={() => handleHireVolunteer(match.taskId, match.volunteerId, match.volunteerName)}
                               >
                                 Authorize Deployment
                               </Button>
                             </DialogFooter>
                           </DialogContent>
                         </Dialog>
                      </CardFooter>
                    </Card>
                  )) : (
                    <div className="col-span-full py-24 text-center border-4 border-dashed rounded-[3rem] opacity-30">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="font-black uppercase tracking-widest text-sm italic">No Optimal Workforce Matches in Sector</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="workforce" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {rawTasks?.filter(t => t.assignedVolunteerId && t.submittedBy === (user?.displayName || "NGO Partner")).map(task => (
                    <Card key={task.id} className="border-2 shadow-lg rounded-2xl overflow-hidden bg-card border-accent/20">
                      <CardHeader className="p-5">
                         <div className="flex justify-between items-center mb-2">
                           <Badge className="bg-accent text-white uppercase text-[8px] font-bold tracking-widest px-2 py-0.5">Active Contract</Badge>
                           <span className="text-[9px] font-bold uppercase text-muted-foreground">{task.workDuration}</span>
                         </div>
                         <CardTitle className="text-lg font-black uppercase leading-tight">{task.assignedTo}</CardTitle>
                         <CardDescription className="text-[10px] font-bold uppercase text-primary">Mission: {task.title}</CardDescription>
                      </CardHeader>
                      <CardContent className="px-5 pb-5 space-y-3">
                         <div className="flex items-center gap-4 text-[10px] font-bold uppercase">
                           <div className="flex items-center gap-1.5 text-muted-foreground">
                             <DollarSign className="h-3.5 w-3.5" /> {task.isPaid ? 'Paid Pro' : 'Volunteer'}
                           </div>
                           <div className="flex items-center gap-1.5 text-muted-foreground">
                             <Clock className="h-3.5 w-3.5" /> Deployment Active
                           </div>
                         </div>
                      </CardContent>
                      <CardFooter className="p-5 pt-0 flex gap-2">
                        <Button variant="outline" className="flex-1 h-10 text-[10px] font-bold uppercase tracking-widest rounded-xl border-2" onClick={() => handleMarkAsCompleted(task.id, task.assignedVolunteerId)}>
                          Complete
                        </Button>
                        <Button variant="destructive" className="flex-1 h-10 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg" onClick={() => handleRemoveResponder(task.id, task.assignedVolunteerId)}>
                          Recall
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                  {rawTasks?.filter(t => t.assignedVolunteerId && t.submittedBy === (user?.displayName || "NGO Partner")).length === 0 && (
                    <div className="col-span-full py-24 text-center border-4 border-dashed rounded-[3rem] opacity-30">
                      <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="font-black uppercase tracking-widest text-sm italic">No Active Personnel in Grid</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transparency">
                  <Card className="border-4 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <CardHeader className="bg-muted/50 p-6 border-b">
                      <CardTitle className="text-xl font-black uppercase">Fleet Transparency Grid</CardTitle>
                      <CardDescription className="font-medium italic">Comprehensive audit of all NGO-managed responders during current emergency operations.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-muted/30 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <tr>
                              <th className="px-6 py-4">Managing NGO</th>
                              <th className="px-6 py-4">Personnel</th>
                              <th className="px-6 py-4">Operational Role</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Sector</th>
                              <th className="px-6 py-4">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-[11px] font-bold">
                            {rawTasks?.filter(t => t.status === 'assigned').map(task => (
                              <tr key={task.id} className="hover:bg-muted/10 transition-colors">
                                <td className="px-6 py-4 text-primary uppercase">{task.submittedBy}</td>
                                <td className="px-6 py-4 uppercase">{task.assignedTo}</td>
                                <td className="px-6 py-4 uppercase text-muted-foreground">Relief Specialist</td>
                                <td className="px-6 py-4">
                                  <Badge className="bg-accent/10 text-accent text-[8px] border-accent/20">Active Deployment</Badge>
                                </td>
                                <td className="px-6 py-4 uppercase text-muted-foreground">{task.category}</td>
                                <td className="px-6 py-4 uppercase font-black">{task.isPaid ? 'Paid' : 'Unpaid'}</td>
                              </tr>
                            ))}
                            {rawTasks?.filter(t => t.status === 'assigned').length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-medium italic opacity-40">No personnel currently engaged in grid operations.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Tabs defaultValue="nearby" className="space-y-6">
                 <TabsList className="bg-muted p-1 rounded-xl h-12 border shadow-sm">
                   <TabsTrigger value="nearby" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white">Nearby Missions</TabsTrigger>
                   <TabsTrigger value="assignments" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-primary data-[state=active]:text-white">My Assignments</TabsTrigger>
                 </TabsList>

                 <TabsContent value="nearby">
                   {!userLocation ? (
                     <div className="py-32 text-center border-4 border-dashed rounded-[3.5rem] bg-card shadow-inner flex flex-col items-center">
                       <Navigation className="h-16 w-16 text-muted-foreground/20 mb-6 animate-pulse" />
                       <h3 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">Tactical Sync Required</h3>
                       <p className="text-sm text-muted-foreground font-medium italic max-w-sm mx-auto mb-8">Synchronize your tactical position to identify missions in your immediate sector.</p>
                       <Button onClick={() => {
                         if (!navigator.geolocation) return;
                         setIsLocating(true);
                         navigator.geolocation.getCurrentPosition(
                           (pos) => {
                             const { latitude, longitude } = pos.coords;
                             setUserLocation([latitude, longitude]);
                             updateMapFocus(latitude, longitude, 13);
                             setIsLocating(false);
                             toast({ title: "Coordinates Secured", description: "GPS position locked to grid." });
                           },
                           () => setIsLocating(false),
                           { enableHighAccuracy: true }
                         );
                       }} className="h-12 px-10 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl shadow-primary/30">Activate GPS Sync</Button>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                       {availableVolunteers.length > 0 && rawTasks?.filter(t => t.status === 'open').map(task => ({
                         ...task,
                         distance: getDistance(userLocation[0], userLocation[1], task.latitude, task.longitude)
                       })).sort((a, b) => a.distance - b.distance).map(task => (
                         <Card key={task.id} className="border-2 shadow-lg bg-card rounded-2xl overflow-hidden flex flex-col hover:border-primary transition-all hover:scale-[1.02]">
                            <div className="p-3 bg-primary/5 border-b flex justify-between items-center px-5">
                               <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                 <LocateFixed className="h-4 w-4" /> {task.distance.toFixed(1)}KM Sector
                               </span>
                               <Badge className="bg-accent text-white font-bold uppercase text-[8px] py-0.5 px-2 rounded-md shadow-sm">Target</Badge>
                            </div>
                            <CardHeader className="p-5 pb-1">
                              <CardTitle className="text-lg font-black uppercase leading-tight truncate">{task.title}</CardTitle>
                              <CardDescription className="font-bold text-[9px] text-muted-foreground tracking-widest uppercase mt-1">{task.category} • {task.location}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-5 pt-2 space-y-4 flex-grow">
                               <p className="text-[11px] text-muted-foreground leading-relaxed italic font-medium line-clamp-3 leading-relaxed">"{task.description}"</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {task.skillsRequired.map((s, i) => (
                                   <Badge key={i} variant="secondary" className="text-[8px] font-bold uppercase py-1 px-2.5 border">{s}</Badge>
                                 ))}
                               </div>
                            </CardContent>
                            <CardFooter className="p-5 pt-0">
                               <Button className="w-full h-11 gap-2 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl shadow-primary/10" onClick={() => handleTaskSelect(task.id)}>
                                 <Route className="h-4 w-4" /> Plot Path to Objective
                               </Button>
                            </CardFooter>
                         </Card>
                       ))}
                     </div>
                   )}
                 </TabsContent>

                 <TabsContent value="assignments">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {rawTasks?.filter(t => t.assignedVolunteerId && t.assignedVolunteerId === user?.uid).map(task => (
                        <Card key={task.id} className="border-4 rounded-[2rem] overflow-hidden shadow-2xl border-accent/20">
                           <CardHeader className="p-6 pb-4">
                             <div className="flex justify-between items-center mb-4">
                               <Badge className="bg-accent text-white uppercase text-[10px] font-black tracking-widest px-3 py-1 shadow-lg">Active Contract</Badge>
                               <span className="text-[10px] font-black uppercase text-muted-foreground bg-muted px-3 py-1 rounded-full">{task.location}</span>
                             </div>
                             <CardTitle className="text-2xl font-black uppercase leading-tight">{task.title}</CardTitle>
                             <CardDescription className="text-xs font-bold uppercase text-primary mt-1">Managed By: {task.submittedBy}</CardDescription>
                           </CardHeader>
                           <CardContent className="px-6 pb-6">
                             <div className="p-4 bg-muted rounded-2xl mb-6 border-2">
                               <p className="text-xs text-muted-foreground font-medium italic leading-relaxed">"{task.description}"</p>
                             </div>
                             <div className="grid grid-cols-2 gap-4 mb-6">
                               <div className="space-y-1">
                                 <p className="text-[8px] font-black uppercase text-muted-foreground">Role</p>
                                 <p className="text-sm font-black uppercase">Relief Responder</p>
                               </div>
                               <div className="space-y-1">
                                 <p className="text-[8px] font-black uppercase text-muted-foreground">Duration</p>
                                 <p className="text-sm font-black uppercase">{task.workDuration}</p>
                               </div>
                             </div>
                             <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-[0.1em] gap-3 shadow-2xl shadow-primary/20" onClick={() => handleTaskSelect(task.id)}>
                               <Route className="h-6 w-6" /> Engage Tactical Path
                             </Button>
                           </CardContent>
                        </Card>
                      ))}
                      {rawTasks?.filter(t => t.assignedVolunteerId && t.assignedVolunteerId === user?.uid).length === 0 && (
                         <div className="col-span-full py-24 text-center border-4 border-dashed rounded-[3rem] opacity-30">
                           <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                           <p className="font-black uppercase tracking-widest text-sm italic">No Current Assignments Active</p>
                         </div>
                      )}
                    </div>
                 </TabsContent>
              </Tabs>
            )}
          </div>

          <aside className="lg:col-span-3 space-y-6">
            <Card className="shadow-2xl border-2 bg-card rounded-[2rem] overflow-hidden">
               <CardHeader className="bg-muted/50 border-b p-5">
                 <CardTitle className="text-[11px] font-black flex items-center gap-2 text-primary uppercase tracking-[0.1em]">
                   <Activity className="h-4 w-4 text-accent" />
                   Tactical Audit Feed
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-5 space-y-4">
                 {activitiesLoading ? (
                   <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                 ) : activities && activities.length > 0 ? (
                   activities.map(act => (
                     <div key={act.id} className="p-4 bg-muted/60 rounded-xl border-l-4 border-primary relative overflow-hidden group hover:bg-muted transition-all cursor-default">
                        <div className={cn("absolute top-0 right-0 w-1 h-full opacity-40", 
                           act.type === 'new_task' ? "bg-primary" : 
                           act.type === 'hired' ? "bg-accent" : "bg-emerald-500")} />
                        <p className="font-black text-foreground text-[10px] leading-snug uppercase mb-1">{act.message}</p>
                        <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest">
                          {act.timestamp?.toMillis ? new Date(act.timestamp.toMillis()).toLocaleTimeString() : 'SYNCHRONIZING'}
                        </p>
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-8 text-[10px] font-black uppercase text-muted-foreground opacity-30 tracking-widest italic">Monitoring Active Grid...</div>
                 )}
               </CardContent>
            </Card>

            <Card className="shadow-2xl border-2 bg-card rounded-[2rem] overflow-hidden">
              <CardHeader className="p-5 bg-muted/50 border-b">
                <CardTitle className="text-[11px] font-black flex items-center gap-2 uppercase tracking-[0.1em] text-primary">
                  <BarChart3 className="h-4 w-4" /> Sector Density
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-8">
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <BarChart data={areaImpact} layout="vertical" margin={{ left: -25 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[9px] font-black uppercase text-muted-foreground" width={70} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="tasks" radius={[0, 6, 6, 0]} fill="hsl(var(--primary))">
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
