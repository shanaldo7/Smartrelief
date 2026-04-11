
"use client"

import { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Zap, AlertTriangle, Database, Activity, Loader2, BarChart3, Map as MapIcon, CheckCircle, Crosshair, Plus, Minus, Navigation, X, Route, UserCheck } from "lucide-react";
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
  loading: () => <div className="h-[450px] w-full bg-muted animate-pulse rounded-xl flex items-center justify-center text-muted-foreground border border-dashed font-bold uppercase tracking-widest">Initializing Tactical Map...</div>
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
  { title: "Emergency Food Relief", description: "Immediate distribution for 500 families in North Kolkata.", skillsRequired: ["Logistics", "General Labor"], location: "Kolkata", latitude: 22.5726, longitude: 88.3639, urgency: "high", priority: 3, status: "open", submittedBy: "Red Cross Partner" },
  { title: "Mobile Medical Clinic", description: "Primary healthcare support in central Delhi residential zones.", skillsRequired: ["Healthcare"], location: "Delhi", latitude: 28.6139, longitude: 77.2090, urgency: "medium", priority: 2, status: "open", submittedBy: "Doctors Without Borders" },
  { title: "Disaster Zone Logistics", description: "Warehouse management and fleet coordination for relief supplies.", skillsRequired: ["Logistics", "Driving"], location: "Mumbai", latitude: 19.0760, longitude: 72.8777, urgency: "high", priority: 3, status: "open", submittedBy: "UNICEF Partner" },
  { title: "Community Teaching Hub", description: "Temporary educational support for displaced students.", skillsRequired: ["Admin", "Teaching"], location: "Delhi", latitude: 28.7041, longitude: 77.1025, urgency: "low", priority: 1, status: "open", submittedBy: "Education First NGO" },
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

  // Logic to calculate smart matches based on proximity and skills
  const matches = useMemo(() => {
    if (!rawTasks || !sortedVolunteers) return [];
    
    const results: Match[] = [];
    rawTasks.filter(t => t.status === 'open').forEach(task => {
      sortedVolunteers.forEach(volunteer => {
        let score = 0;
        const reasons: string[] = [];

        // Skill matching
        const matchedSkills = task.skillsRequired.filter(skill => 
          volunteer.skills.some(vSkill => vSkill.toLowerCase() === skill.toLowerCase())
        );
        if (matchedSkills.length > 0) {
          score += matchedSkills.length * 25;
          reasons.push(`${matchedSkills.length} expertise areas match`);
        }

        // Location proximity (city matching)
        if (task.location.toLowerCase() === volunteer.location.toLowerCase()) {
          score += 50;
          reasons.push("Local Rescuer (Same City)");
        }

        if (score > 30) {
          results.push({
            taskId: task.id,
            volunteerId: volunteer.id,
            score: score + (task.priority * 10),
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
        setMapZoom(14);
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
      toast({ variant: "destructive", title: "Unsupported", description: "Geolocation is not supported." });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setMapZoom(13);
        setIsLocating(false);
        toast({ title: "Position Detected", description: "Centering map on your current location." });
      },
      (error) => {
        setIsLocating(false);
        toast({ variant: "destructive", title: "Detection Failed", description: "Could not retrieve your location." });
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
      toast({ title: "Tactical Data Sync", description: "Imported humanitarian tasks from NGO verified partners." });
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
    toast({ title: "Rescuer Assigned", description: `${volunteerName} is now leading this response.` });
  };

  const handleMarkAsCompleted = (taskId: string) => {
    if (!db) return;
    const taskRef = doc(db, "tasks", taskId);
    updateDocumentNonBlocking(taskRef, {
      status: "completed",
      updatedAt: serverTimestamp(),
    });
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    toast({ title: "Need Fulfilled", description: `Task has been cleared from active coordination.` });
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
            <p className="text-muted-foreground italic font-medium">Strategic real-time mapping and resource mobilization for humanitarian crises.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              className="gap-2 border-primary text-primary hover:bg-primary/5" 
              onClick={handleLocateMe}
              disabled={isLocating}
            >
              <Navigation className={cn("h-4 w-4", isLocating && "animate-pulse")} />
              {isLocating ? "Locating..." : "Detect My Location"}
            </Button>
            <Button 
              variant="default" 
              className="shadow-md gap-2"
              onClick={handleFetchNGOData}
              disabled={isImporting}
            >
              <Database className="h-4 w-4" />
              {isImporting ? "Syncing NGO Data..." : "Fetch NGO Data"}
            </Button>
            <div className="flex h-10 items-center gap-4 bg-card px-4 rounded-xl shadow-sm border">
               <div className="flex items-center gap-1.5 border-r pr-4">
                 <Activity className="h-4 w-4 text-red-500" />
                 <span className="text-sm font-bold">{rawTasks?.filter(t => t.status === 'open').length || 0}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold ml-1">Needs</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <Users className="h-4 w-4 text-primary" />
                 <span className="text-sm font-bold">{sortedVolunteers.length}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold ml-1">Rescuers</span>
               </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          <div className="lg:col-span-3 space-y-8">
            <Card className="border-none shadow-xl overflow-hidden h-[450px] relative bg-card rounded-2xl">
              <InteractiveMap 
                tasks={activeTasksForMap} 
                volunteers={rawVolunteers || []} 
                center={mapCenter} 
                zoom={mapZoom}
                userLocation={userLocation}
                selectedTaskId={selectedTaskId}
                onTaskSelect={handleTaskSelect}
              />
              <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                {selectedTaskId && userLocation && (
                   <div className="bg-primary text-primary-foreground px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-4 ring-2 ring-white">
                     <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold opacity-80">Tactical Path Active</span>
                       <span className="text-xs font-bold truncate max-w-[150px]">
                         {activeTasksForMap.find(t => t.id === selectedTaskId)?.title}
                       </span>
                     </div>
                     <Button 
                       size="icon" 
                       variant="ghost" 
                       className="h-6 w-6 hover:bg-white/20" 
                       onClick={() => setSelectedTaskId(null)}
                     >
                       <X className="h-3 w-3" />
                     </Button>
                   </div>
                )}
                <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border text-[10px] font-bold uppercase space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-sm" /> High Urgency Need
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm" /> Medium Urgency Need
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" /> Low Urgency Need
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" /> Active Rescuer
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-white shadow-sm" /> You (Responder)
                  </div>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 z-[1000] flex gap-2">
                <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full shadow-lg border-2 border-white" onClick={() => setMapZoom(prev => Math.min(prev + 1, 18))}>
                  <Plus className="h-5 w-5" />
                </Button>
                <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full shadow-lg border-2 border-white" onClick={() => setMapZoom(prev => Math.max(prev - 1, 3))}>
                  <Minus className="h-5 w-5" />
                </Button>
              </div>
            </Card>

             <Tabs defaultValue="matches" className="space-y-8">
               <div className="flex justify-between items-center">
                 <TabsList className="grid w-full grid-cols-3 max-w-md h-12 bg-muted p-1 rounded-xl">
                   <TabsTrigger value="matches" className="rounded-lg font-bold">Smart Matches</TabsTrigger>
                   <TabsTrigger value="tasks" className="rounded-lg font-bold">Incident Feed</TabsTrigger>
                   <TabsTrigger value="volunteers" className="rounded-lg font-bold">Rescuers</TabsTrigger>
                 </TabsList>
               </div>

               <TabsContent value="matches" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {matches.length > 0 ? (
                     matches.filter(m => locationFilter === 'all' || m.location === locationFilter).slice(0, 9).map((match, i) => (
                       <Card key={`${match.taskId}-${match.volunteerId}`} className="border-none shadow-md hover:shadow-xl transition-all duration-300 bg-card group flex flex-col relative overflow-hidden rounded-2xl">
                         <div className="absolute top-0 right-0 p-4">
                           <div className="bg-primary/10 text-primary text-[10px] font-extrabold uppercase px-3 py-1 rounded-full flex items-center gap-1.5 border border-primary/20">
                             <Zap className="h-3 w-3" /> {match.score} Combat Score
                           </div>
                         </div>
                         <CardHeader className="pb-2">
                           <CardTitle className="text-lg flex items-center gap-2 font-bold">Local Proximity Match</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-4 flex-grow">
                           <div className="p-3 bg-muted/40 rounded-xl border-l-4 border-red-500">
                             <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Target Area: {match.location}</p>
                             <p className="font-bold text-foreground truncate">{match.taskTitle}</p>
                           </div>
                           <div className="p-3 bg-primary/5 rounded-xl border-l-4 border-primary">
                             <p className="text-[10px] font-bold text-primary uppercase mb-1">Assigned Candidate</p>
                             <p className="font-bold text-foreground">{match.volunteerName}</p>
                           </div>
                           <div className="flex flex-wrap gap-1.5">
                             {match.reasons.map((r, idx) => (
                               <Badge key={idx} variant="secondary" className="text-[9px] font-bold uppercase">{r}</Badge>
                             ))}
                           </div>
                         </CardContent>
                         <CardFooter className="pt-2">
                            <Button className="w-full gap-2 font-bold rounded-xl" size="sm" onClick={() => handleAssignVolunteer(match.taskId, match.volunteerName)}>
                              <UserCheck className="h-4 w-4" /> Deploy Rescuer
                            </Button>
                         </CardFooter>
                       </Card>
                     ))
                   ) : (
                     <div className="col-span-full py-20 text-center bg-card rounded-3xl border-2 border-dashed">
                       <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                       <h3 className="text-lg font-bold text-muted-foreground">No tactical matches detected for this sector.</h3>
                       <p className="text-sm text-muted-foreground mt-2">Try syncing NGO data or adjusting filters.</p>
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
                         "border-none shadow-sm bg-card relative transition-all hover:shadow-md rounded-2xl", 
                         task.status === 'completed' && "opacity-60 grayscale",
                         selectedTaskId === task.id && "ring-2 ring-primary"
                       )}
                     >
                       <CardHeader className="pb-2">
                         <div className="flex justify-between items-start mb-2">
                           <Badge className={cn("text-[10px] uppercase font-extrabold", 
                             task.urgency === 'high' ? "bg-red-500" : 
                             task.urgency === 'medium' ? "bg-amber-500" : "bg-emerald-500")}>
                             {task.urgency} Priority
                           </Badge>
                           <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-bold uppercase">
                             <MapPin className="h-3 w-3" /> {task.location}
                           </div>
                         </div>
                         <CardTitle className="text-lg font-bold truncate">{task.title}</CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4 pt-2">
                         <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{task.description}</p>
                       </CardContent>
                       <CardFooter className="pt-0 flex gap-2">
                         {task.status === 'open' && (
                           <Button variant="ghost" size="sm" className="flex-1 text-xs font-bold" onClick={() => handleMarkAsCompleted(task.id)}>
                             <CheckCircle className="h-3 w-3 mr-2" /> Fulfil
                           </Button>
                         )}
                         <Button 
                           variant={selectedTaskId === task.id ? "default" : "outline"} 
                           size="sm" 
                           className="flex-1 text-xs gap-2 font-bold" 
                           onClick={() => handleTaskSelect(task.id)}
                         >
                           <Route className="h-3 w-3" /> Tactical Path
                         </Button>
                       </CardFooter>
                     </Card>
                   ))}
                 </div>
               </TabsContent>
               
               <TabsContent value="volunteers" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {sortedVolunteers.filter(v => locationFilter === 'all' || v.location === locationFilter).map(volunteer => (
                     <Card key={volunteer.id} className="border-none shadow-sm bg-card rounded-2xl hover:shadow-md transition-shadow">
                       <CardHeader className="pb-2">
                         <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-extrabold uppercase mb-2">
                           <MapPin className="h-3.5 w-3.5 text-blue-500" /> Based in {volunteer.location}
                         </div>
                         <CardTitle className="text-lg font-bold flex items-center gap-2">
                           {volunteer.name}
                           <Badge variant="outline" className="text-[9px] font-bold">Rescuer</Badge>
                         </CardTitle>
                       </CardHeader>
                       <CardContent className="space-y-4 pt-2">
                         <div className="flex flex-wrap gap-1.5">
                           {volunteer.skills.map((skill, idx) => (
                             <Badge key={idx} variant="secondary" className="text-[10px] font-medium">{skill}</Badge>
                           ))}
                         </div>
                         <div className="pt-2 border-t">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                               <Zap className="h-3 w-3 text-amber-500" />
                               Nearby Problems: {activeTasksForMap.filter(t => t.location === volunteer.location).length} Identified
                            </p>
                         </div>
                       </CardContent>
                       <CardFooter className="pt-0">
                         <Button variant="outline" size="sm" className="w-full text-xs font-bold rounded-xl" onClick={() => { setMapCenter([volunteer.latitude, volunteer.longitude]); setMapZoom(15); }}>
                           <MapIcon className="h-3 w-3 mr-2" /> Locate on Map
                         </Button>
                       </CardFooter>
                     </Card>
                   ))}
                 </div>
               </TabsContent>
             </Tabs>
          </div>

          <aside className="lg:col-span-1 space-y-6">
            <Card className="shadow-lg border-none bg-primary/5 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2 bg-primary/10">
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                  <BarChart3 className="h-4 w-4 text-primary" /> Regional Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart 
                    data={areaImpact} 
                    layout="vertical" 
                    margin={{ left: -20 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} className="text-[10px] font-bold uppercase" />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar 
                      dataKey="tasks" 
                      radius={4}
                      className="cursor-pointer"
                      onClick={(data) => {
                        if (data && data.name) handleRegionClick(data.name);
                      }}
                    >
                      {areaImpact.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                
                <div className="mt-6 space-y-2">
                  <Button 
                    variant={locationFilter === 'all' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="w-full justify-start text-xs h-9 font-bold rounded-xl" 
                    onClick={() => handleRegionClick('all')}
                  >
                    <Activity className="h-3 w-3 mr-2" /> All Operations
                  </Button>
                  {areaImpact.map((area) => (
                    <Button 
                      key={area.name} 
                      variant={locationFilter === area.name ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="w-full justify-between text-xs h-9 font-bold rounded-xl" 
                      onClick={() => handleRegionClick(area.name)}
                    >
                      <span className="flex items-center"><MapPin className="h-3 w-3 mr-2" /> {area.name}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-extrabold">{area.tasks}</Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-accent/5 rounded-2xl">
               <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-extrabold uppercase text-accent tracking-widest">Optimization Log</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4 pt-2">
                  <div className="p-4 bg-white rounded-xl border-l-4 border-emerald-500 shadow-sm text-[11px] font-medium leading-relaxed">
                    Centering on your location identifies local needs where immediate impact is possible. 
                    <span className="block mt-1 text-emerald-600 font-bold">Proximity matching is now active.</span>
                  </div>
                  {selectedTaskId && userLocation && (
                    <div className="p-4 bg-primary/10 rounded-xl border-l-4 border-primary shadow-sm text-[11px] font-medium leading-relaxed animate-pulse">
                      Tactical overlay is rendering the direct path to {activeTasksForMap.find(t => t.id === selectedTaskId)?.title}. Follow the dash indicators for movement.
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
