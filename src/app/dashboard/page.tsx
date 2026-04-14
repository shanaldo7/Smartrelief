
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
import { collection, serverTimestamp, doc, query, orderBy, limit, deleteField, setDoc, arrayUnion } from "firebase/firestore";
import { MapPin, AlertTriangle, Activity, Loader2, BarChart3, Navigation, ShieldCheck, FilterX, Target, LocateFixed, Route, UserCheck, UserMinus, XCircle, RotateCcw, Briefcase, Clock, Users, DollarSign, Send, CheckCircle2, Globe, Zap, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";

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
  paymentAmount?: number;
  workDuration?: string;
  requiredPeople?: number;
  applicants?: string[];
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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

  const currentUserProfile = useMemo(() => {
    if (!rawVolunteers || !user) return null;
    return rawVolunteers.find(v => v.id === user.uid);
  }, [rawVolunteers, user]);

  const activeTasksForMap = useMemo(() => {
    if (!rawTasks) return EMPTY_ARRAY;
    return rawTasks.filter(t => t.status !== 'completed');
  }, [rawTasks]);

  const renderTags = useCallback((task: Task) => {
    const tags = [];
    
    // Urgent Need
    if (task.urgency === 'high') {
      tags.push({ label: 'Urgent Need', icon: AlertTriangle, color: 'bg-destructive text-destructive-foreground' });
    }

    // Opportunity Type
    if (task.isPaid) {
      tags.push({ label: 'Part-Time Job', icon: Briefcase, color: 'bg-primary text-primary-foreground' });
    } else {
      tags.push({ label: 'Volunteer Work', icon: Heart, color: 'bg-accent text-accent-foreground' });
    }

    // Local vs Remote
    let isLocal = false;
    if (currentUserProfile) {
      const dist = getDistance(currentUserProfile.latitude, currentUserProfile.longitude, task.latitude, task.longitude);
      if (dist < 15) isLocal = true;
    } else if (userLocation) {
      const dist = getDistance(userLocation[0], userLocation[1], task.latitude, task.longitude);
      if (dist < 15) isLocal = true;
    }

    if (isLocal) {
      tags.push({ label: 'Local Opportunity', icon: MapPin, color: 'bg-emerald-500 text-white' });
    } else {
      tags.push({ label: 'Remote NGO Support', icon: Globe, color: 'bg-slate-500 text-white' });
    }

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {tags.map((tag, idx) => (
          <Badge key={idx} className={cn("text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 border-none", tag.color)}>
            <tag.icon className="h-2 w-2 mr-1" />
            {tag.label}
          </Badge>
        ))}
      </div>
    );
  }, [currentUserProfile, userLocation]);

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

  const handleApplyForMission = useCallback((taskId: string) => {
    if (!db || !user) return;
    updateDocumentNonBlocking(doc(db, "tasks", taskId), {
      applicants: arrayUnion(user.uid)
    });
    logActivity("application", `${user.displayName || 'Responder'} applied for mission: ${taskId}`);
    toast({ title: "Application Transmitted", description: "NGO has received your coordinates." });
  }, [db, user, logActivity, toast]);

  const handleHireVolunteer = useCallback((taskId: string, volunteerId: string, volunteerName: string) => {
    if (!db || !user) return;
    const task = rawTasks?.find(t => t.id === taskId);
    const durationStr = `${assignmentParams.duration} ${assignmentParams.unit}`;
    
    updateDocumentNonBlocking(doc(db, "tasks", taskId), {
      status: "assigned",
      assignedTo: volunteerName,
      assignedVolunteerId: volunteerId,
      isPaid: assignmentParams.isPaid,
      workDuration: durationStr,
      startTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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

    logActivity("hired", `${volunteerName} deployed for ${task?.title}`);
    toast({ title: "Workforce Deployed", description: `${volunteerName} assignment active.` });
  }, [db, user, rawTasks, assignmentParams, logActivity, toast]);

  const handleRemoveResponder = useCallback((taskId: string, volunteerId?: string) => {
    if (!db) return;
    const task = rawTasks?.find(t => t.id === taskId);
    updateDocumentNonBlocking(doc(db, "tasks", taskId), {
      status: "open",
      assignedTo: deleteField(),
      assignedVolunteerId: deleteField(),
      isPaid: deleteField(),
      workDuration: deleteField(),
      updatedAt: serverTimestamp(),
    });
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
    toast({ title: "Mission Successful", description: "Personnel released." });
  }, [db, toast, rawTasks, logActivity]);

  const handleFocusEmergency = useCallback(() => {
    if (!rawTasks) return;
    const highUrgency = rawTasks.filter(t => t.status === 'open' && t.urgency === 'high');
    if (highUrgency.length > 0) {
      const top = highUrgency.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
      handleTaskSelect(top.id);
      toast({ title: "🚨 Emergency Focus Lock", description: `Centering on high-priority mission: ${top.title}` });
    } else {
      toast({ title: "Operational Status Clear", description: "No high-urgency tasks detected in grid." });
    }
  }, [rawTasks, handleTaskSelect, toast]);

  const handleResetFilters = useCallback(() => {
    setCategoryFilter('all');
    setUrgencyFilter('all');
    setLocationFilter('all');
    setMapCenter(DEFAULT_CENTER);
    setMapZoom(DEFAULT_ZOOM);
    setSelectedTaskId(null);
    toast({ title: "Grid Reset", description: "All filters and views returned to global defaults." });
  }, [toast]);

  const filteredTasks = useMemo(() => {
    if (!rawTasks) return EMPTY_ARRAY;
    return rawTasks.filter(t => {
      const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
      const matchUrg = urgencyFilter === 'all' || t.urgency === urgencyFilter;
      const matchLoc = locationFilter === 'all' || t.location === locationFilter;
      return matchCat && matchUrg && matchLoc;
    });
  }, [rawTasks, categoryFilter, urgencyFilter, locationFilter]);

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
                Command Hub
              </h1>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Strategic Response Hub • <span className="text-primary">Live Data Sync</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             <Button variant="destructive" size="sm" className="h-10 rounded-xl font-black uppercase text-[10px] px-5 shadow-lg group" onClick={handleFocusEmergency}>
               <AlertTriangle className="h-4 w-4 mr-2 group-hover:scale-125 transition-transform" />
               🚨 Focus Emergency
             </Button>

            <div className="bg-muted p-1 rounded-xl flex gap-1 border shadow-sm h-10 items-center">
              <Button 
                variant={simulationRole === 'ngo' ? 'default' : 'ghost'} 
                size="sm"
                className={cn("rounded-lg font-bold uppercase text-[9px] tracking-widest px-4 h-8", simulationRole === 'ngo' && "shadow-sm")}
                onClick={() => setSimulationRole('ngo')}
              >
                NGO Control
              </Button>
              <Button 
                variant={simulationRole === 'volunteer' ? 'default' : 'ghost'} 
                size="sm"
                className={cn("rounded-lg font-bold uppercase text-[9px] tracking-widest px-4 h-8", simulationRole === 'volunteer' && "shadow-sm")}
                onClick={() => setSimulationRole('volunteer')}
              >
                Responder
              </Button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-9 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-card p-4 rounded-2xl border shadow-sm">
               <div className="space-y-1">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Relief Sector</Label>
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="rounded-xl h-10 border-2"><SelectValue placeholder="Category" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Sectors</SelectItem>
                     <SelectItem value="Food">Food Distribution</SelectItem>
                     <SelectItem value="Medical">Medical Aid</SelectItem>
                     <SelectItem value="Teaching">Education</SelectItem>
                     <SelectItem value="Logistics">Supply Chain</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Urgency</Label>
                 <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                   <SelectTrigger className="rounded-xl h-10 border-2"><SelectValue placeholder="Urgency" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Levels</SelectItem>
                     <SelectItem value="high">Critical</SelectItem>
                     <SelectItem value="medium">Standard</SelectItem>
                     <SelectItem value="low">Low Priority</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Sector Area</Label>
                 <Input className="rounded-xl h-10 border-2" placeholder="Search City..." value={locationFilter === 'all' ? '' : locationFilter} onChange={e => setLocationFilter(e.target.value || 'all')} />
               </div>
               <div className="flex items-end">
                 <Button variant="outline" className="w-full h-10 rounded-xl font-bold uppercase text-[9px] tracking-widest border-2 gap-2" onClick={handleResetFilters}>
                   <RotateCcw className="h-3.5 w-3.5" />
                   Reset View
                 </Button>
               </div>
            </div>

            <Card className="border-2 shadow-2xl overflow-hidden h-[500px] relative bg-card rounded-[2.5rem]">
              <InteractiveMap 
                tasks={filteredTasks} 
                volunteers={rawVolunteers || EMPTY_ARRAY} 
                center={mapCenter} 
                zoom={mapZoom}
                userLocation={userLocation}
                selectedTaskId={selectedTaskId}
                onTaskSelect={handleTaskSelect}
                renderTags={renderTags}
              />
              {selectedTaskId && (
                <div className="absolute top-6 left-6 z-10">
                  <Button size="sm" variant="secondary" className="rounded-full shadow-2xl font-black uppercase text-[9px] px-6 h-10 border-2 border-white/50 backdrop-blur-md" onClick={() => setSelectedTaskId(null)}>
                    <XCircle className="h-4 w-4 mr-2" /> Deactivate Route
                  </Button>
                </div>
              )}
            </Card>

            {simulationRole === 'ngo' ? (
              <Tabs defaultValue="broadcasts" className="space-y-6">
                <TabsList className="bg-muted p-1 rounded-xl h-12 border shadow-sm w-full sm:w-auto">
                  <TabsTrigger value="broadcasts" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full">Broadcasts</TabsTrigger>
                  <TabsTrigger value="workforce" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full">Operational Workforce</TabsTrigger>
                  <TabsTrigger value="transparency" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full">Transparency Grid</TabsTrigger>
                </TabsList>

                <TabsContent value="broadcasts" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredTasks.filter(t => t.submittedBy === (user?.displayName || "NGO Partner") && t.status === 'open').map(task => (
                      <Card key={task.id} className="border-2 rounded-2xl overflow-hidden bg-card">
                         <CardHeader className="pb-2">
                           <div className="flex justify-between items-start">
                             <Badge variant="outline" className="text-[8px] font-bold uppercase">{task.category}</Badge>
                             <Badge className="bg-primary/10 text-primary uppercase text-[8px]">{task.applicants?.length || 0} Applicants</Badge>
                           </div>
                           <CardTitle className="text-lg font-black uppercase mt-2">{task.title}</CardTitle>
                           {renderTags(task)}
                         </CardHeader>
                         <CardContent className="space-y-4">
                           <div className="p-3 bg-muted rounded-xl text-[10px] font-medium italic">
                             {task.description}
                           </div>
                           <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase">
                             <div className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Req: {task.requiredPeople || 1}</div>
                             <div className="flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> {task.isPaid ? `$${task.paymentAmount}` : 'Volunteer'}</div>
                           </div>
                           
                           <div className="pt-4 border-t space-y-2">
                             <p className="text-[9px] font-black uppercase text-muted-foreground">Recent Applicants</p>
                             {task.applicants?.map(appId => {
                               const applicant = rawVolunteers?.find(v => v.id === appId);
                               return (
                                 <div key={appId} className="flex justify-between items-center p-2 bg-muted/40 rounded-lg border">
                                   <span className="text-[10px] font-bold uppercase">{applicant?.name || "Anonymous"}</span>
                                   <Dialog>
                                     <DialogTrigger asChild>
                                       <Button size="sm" variant="outline" className="h-7 text-[8px] font-bold uppercase">Authorize</Button>
                                     </DialogTrigger>
                                     <DialogContent className="rounded-3xl">
                                       <DialogHeader>
                                         <DialogTitle className="uppercase font-black">Authorize Deployment</DialogTitle>
                                         <DialogDescription>Assign {applicant?.name} to mission: {task.title}</DialogDescription>
                                       </DialogHeader>
                                       <div className="space-y-4 py-4">
                                         <Input placeholder="Operational Role (e.g. Lead Medic)" onChange={e => setAssignmentParams(p => ({...p, role: e.target.value}))} />
                                         <div className="grid grid-cols-2 gap-2">
                                           <Input type="number" placeholder="Duration" onChange={e => setAssignmentParams(p => ({...p, duration: e.target.value}))} />
                                           <Select onValueChange={v => setAssignmentParams(p => ({...p, unit: v}))}>
                                             <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                                             <SelectContent>
                                               <SelectItem value="hours">Hours</SelectItem>
                                               <SelectItem value="days">Days</SelectItem>
                                             </SelectContent>
                                           </Select>
                                         </div>
                                       </div>
                                       <DialogFooter>
                                         <Button className="w-full uppercase font-black" onClick={() => handleHireVolunteer(task.id, appId, applicant?.name || "Responder")}>Confirm Deployment</Button>
                                       </DialogFooter>
                                     </DialogContent>
                                   </Dialog>
                                 </div>
                               );
                             })}
                             {(!task.applicants || task.applicants.length === 0) && (
                               <p className="text-[9px] italic text-muted-foreground">No active applicants in sector.</p>
                             )}
                           </div>
                         </CardContent>
                      </Card>
                    ))}
                    {filteredTasks.filter(t => t.submittedBy === (user?.displayName || "NGO Partner") && t.status === 'open').length === 0 && (
                      <div className="col-span-full py-12 text-center border-4 border-dashed rounded-3xl opacity-30">
                        <Send className="h-10 w-10 mx-auto mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">No matching recruitment broadcasts.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="workforce" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredTasks.filter(t => t.assignedVolunteerId && t.submittedBy === (user?.displayName || "NGO Partner")).map(task => (
                    <Card key={task.id} className="border-2 shadow-lg rounded-2xl overflow-hidden bg-card border-accent/20">
                      <CardHeader className="p-5">
                         <div className="flex justify-between items-center mb-2">
                           <Badge className="bg-accent text-white uppercase text-[8px] font-bold tracking-widest px-2 py-0.5">On Duty</Badge>
                           <span className="text-[9px] font-bold uppercase text-muted-foreground">{task.workDuration}</span>
                         </div>
                         <CardTitle className="text-lg font-black uppercase leading-tight">{task.assignedTo}</CardTitle>
                         <CardDescription className="text-[10px] font-bold uppercase text-primary">Mission: {task.title}</CardDescription>
                         {renderTags(task)}
                      </CardHeader>
                      <CardFooter className="p-5 pt-0 flex gap-2">
                        <Button variant="outline" className="flex-1 h-10 text-[10px] font-bold uppercase rounded-xl border-2" onClick={() => handleMarkAsCompleted(task.id, task.assignedVolunteerId)}>
                          Success
                        </Button>
                        <Button variant="destructive" className="flex-1 h-10 text-[10px] font-bold uppercase rounded-xl shadow-lg" onClick={() => handleRemoveResponder(task.id, task.assignedVolunteerId)}>
                          Recall
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="transparency">
                  <Card className="border-4 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <CardHeader className="bg-muted/50 p-6 border-b">
                      <CardTitle className="text-xl font-black uppercase">Fleet Transparency Grid</CardTitle>
                      <CardDescription className="font-medium italic">Audit of all managed responders during operations.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-muted/30 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            <tr>
                              <th className="px-6 py-4">NGO Agent</th>
                              <th className="px-6 py-4">Responder Unit</th>
                              <th className="px-6 py-4">Mission</th>
                              <th className="px-6 py-4">Type</th>
                              <th className="px-6 py-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-[11px] font-bold">
                            {filteredTasks.filter(t => t.status === 'assigned').map(task => (
                              <tr key={task.id} className="hover:bg-muted/10">
                                <td className="px-6 py-4 uppercase">{task.submittedBy}</td>
                                <td className="px-6 py-4 uppercase">{task.assignedTo}</td>
                                <td className="px-6 py-4 uppercase text-muted-foreground">{task.title}</td>
                                <td className="px-6 py-4 uppercase">{task.isPaid ? 'Part-Time' : 'Volunteer'}</td>
                                <td className="px-6 py-4">
                                  <Badge className="bg-accent/10 text-accent text-[8px] uppercase">Active Deployment</Badge>
                                </td>
                              </tr>
                            ))}
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
                   <TabsTrigger value="nearby" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full">Mission Board</TabsTrigger>
                   <TabsTrigger value="assignments" className="rounded-lg font-bold uppercase text-[10px] tracking-widest px-6 h-full">My Assignments</TabsTrigger>
                 </TabsList>

                 <TabsContent value="nearby">
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {filteredTasks.filter(t => t.status === 'open').map(task => {
                       const dist = (userLocation || (currentUserProfile ? [currentUserProfile.latitude, currentUserProfile.longitude] : null)) 
                         ? getDistance(
                             userLocation?.[0] || currentUserProfile?.latitude || 0, 
                             userLocation?.[1] || currentUserProfile?.longitude || 0, 
                             task.latitude, 
                             task.longitude
                           ) 
                         : null;
                       const hasApplied = task.applicants?.includes(user?.uid || "");
                       return (
                         <Card key={task.id} className="border-2 shadow-lg bg-card rounded-2xl overflow-hidden flex flex-col hover:border-primary transition-all">
                            <CardHeader className="p-5 pb-1">
                              <div className="flex justify-between items-center mb-2">
                                <Badge className="bg-accent text-white uppercase text-[8px]">{task.category}</Badge>
                                {dist !== null && <span className="text-[9px] font-black text-primary">{dist.toFixed(1)}KM</span>}
                              </div>
                              <CardTitle className="text-lg font-black uppercase truncate">{task.title}</CardTitle>
                              {renderTags(task)}
                            </CardHeader>
                            <CardContent className="p-5 pt-2 space-y-4 flex-grow">
                               <p className="text-[11px] text-muted-foreground italic font-medium line-clamp-3">"{task.description}"</p>
                            </CardContent>
                            <CardFooter className="p-5 pt-0 flex gap-2">
                               <Button className="flex-1 h-11 text-[10px] font-black uppercase rounded-xl shadow-md" onClick={() => handleTaskSelect(task.id)}>
                                 <MapPin className="h-4 w-4 mr-2" /> Locate
                               </Button>
                               <Button 
                                 variant={hasApplied ? "secondary" : "default"} 
                                 disabled={hasApplied}
                                 className="flex-1 h-11 text-[10px] font-black uppercase rounded-xl shadow-lg"
                                 onClick={() => handleApplyForMission(task.id)}
                               >
                                 {hasApplied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                 {hasApplied ? 'Registered' : 'Apply'}
                               </Button>
                            </CardFooter>
                         </Card>
                       );
                     })}
                   </div>
                 </TabsContent>

                 <TabsContent value="assignments">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredTasks.filter(t => t.assignedVolunteerId && t.assignedVolunteerId === user?.uid).map(task => (
                        <Card key={task.id} className="border-4 rounded-[2rem] overflow-hidden shadow-2xl border-accent/20">
                           <CardHeader className="p-6">
                             <Badge className="bg-accent text-white uppercase text-[10px] font-black mb-4 w-fit">Active Unit Duty</Badge>
                             <CardTitle className="text-2xl font-black uppercase leading-tight">{task.title}</CardTitle>
                             <CardDescription className="text-xs font-bold uppercase text-primary mt-1">Managed By: {task.submittedBy}</CardDescription>
                             {renderTags(task)}
                           </CardHeader>
                           <CardContent className="px-6 pb-6">
                             <div className="p-4 bg-muted rounded-2xl mb-6">
                               <p className="text-xs text-muted-foreground font-medium italic leading-relaxed">"{task.description}"</p>
                             </div>
                             <Button className="w-full h-14 rounded-2xl font-black uppercase text-xs gap-3 shadow-xl" onClick={() => handleTaskSelect(task.id)}>
                               <Route className="h-6 w-6" /> Engaged Tactical Path
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
            <Card className="shadow-2xl border-2 bg-card rounded-[2rem] overflow-hidden">
               <CardHeader className="bg-muted/50 border-b p-5">
                 <CardTitle className="text-[11px] font-black flex items-center gap-2 text-primary uppercase">
                   <Activity className="h-4 w-4 text-accent" />
                   Operational Log
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-5 space-y-4">
                 {activities?.map(act => (
                   <div key={act.id} className="p-3 bg-muted/60 rounded-xl border-l-4 border-primary">
                      <p className="font-black text-foreground text-[10px] uppercase mb-1">{act.message}</p>
                      <p className="text-[8px] text-muted-foreground uppercase font-black">
                        {act.timestamp?.toMillis ? new Date(act.timestamp.toMillis()).toLocaleTimeString() : '...'}
                      </p>
                   </div>
                 ))}
               </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
