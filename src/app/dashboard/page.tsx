
"use client"

import { useState, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, useUser } from "@/firebase";
import { collection, query, serverTimestamp, doc } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Zap, AlertTriangle, Database, Activity, Loader2, BarChart3, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

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
  createdAt?: any;
}

interface Volunteer {
  id: string;
  name: string;
  location: string;
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
  { title: "Flood Shelter Support", description: "Assisting families with bedding and food supplies in flooded residential zones.", skillsRequired: ["General Labor", "Admin"], location: "Riverside", urgency: "high", priority: 3, status: "open", submittedBy: "Emergency Response NGO" },
  { title: "First Aid Station Assistance", description: "Looking for healthcare workers to assist at the mobile clinics.", skillsRequired: ["Healthcare"], location: "Downtown", urgency: "high", priority: 3, status: "open", submittedBy: "Red Cross" },
  { title: "Logistics Coordinator", description: "Coordinating truck arrivals and inventory of water supplies.", skillsRequired: ["Admin", "Tech Support"], location: "East Port", urgency: "medium", priority: 2, status: "open", submittedBy: "Food Bank" },
  { title: "Tech Support for Ops Center", description: "Maintaining internet and radio comms for rescue teams.", skillsRequired: ["Tech Support"], location: "Command Center", urgency: "medium", priority: 2, status: "open", submittedBy: "Response Corps" },
  { title: "Neighborhood Cleanup", description: "Clearing debris from local roads to allow emergency access.", skillsRequired: ["General Labor", "Driving"], location: "West Hills", urgency: "low", priority: 1, status: "open", submittedBy: "City Council" },
  { title: "Water Distribution", description: "Delivering clean water to families in cut-off areas.", skillsRequired: ["Driving", "General Labor"], location: "Riverside", urgency: "high", priority: 3, status: "open", submittedBy: "WaterAid" },
  { title: "Mental Health Support", description: "Providing counseling for families affected by the disaster.", skillsRequired: ["Healthcare"], location: "Downtown", urgency: "medium", priority: 2, status: "open", submittedBy: "Unity Care" },
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
    rawTasks?.forEach(t => {
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

  const handleImportData = async () => {
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
        title: "NGO Data Imported",
        description: `Successfully loaded ${SAMPLE_NGO_DATA.length} sample tasks across ${new Set(SAMPLE_NGO_DATA.map(d => d.location)).size} locations.`,
      });
    } catch (error) {
      // Handled globally
    } finally {
      setIsImporting(false);
    }
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
              {isImporting ? "Importing..." : "Sync Regional Data"}
            </Button>
            <div className="flex h-10 items-center gap-4 bg-card px-4 rounded-xl shadow-sm border">
               <div className="flex items-center gap-1.5 border-r pr-4">
                 <Activity className="h-4 w-4 text-primary" />
                 <span className="text-sm font-bold">{rawTasks?.length || 0}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Needs</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <Users className="h-4 w-4 text-accent" />
                 <span className="text-sm font-bold">{sortedVolunteers.length}</span>
                 <span className="text-[10px] text-muted-foreground uppercase font-semibold">Rescuers</span>
               </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          {/* Geospatial Focus Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            <Card className="shadow-sm border-none bg-primary/5 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" />
                  Impact Density
                </CardTitle>
                <CardDescription className="text-[10px]">Active needs per region</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={areaImpact} layout="vertical" margin={{ left: -20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tickLine={false} 
                      axisLine={false}
                      className="text-[10px] font-bold"
                    />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="tasks" radius={4}>
                      {areaImpact.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                
                <div className="mt-6 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Regional Explorer</p>
                  <Button 
                    variant={locationFilter === 'all' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="w-full justify-start text-xs h-8"
                    onClick={() => setLocationFilter('all')}
                  >
                    <Activity className="h-3 w-3 mr-2" /> Global View
                  </Button>
                  {areaImpact.map((area) => (
                    <Button 
                      key={area.name}
                      variant={locationFilter === area.name ? 'secondary' : 'ghost'} 
                      size="sm" 
                      className="w-full justify-between text-xs h-8"
                      onClick={() => setLocationFilter(area.name)}
                    >
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-2" /> {area.name}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">{area.tasks}</Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-accent/5">
               <CardHeader className="pb-2">
                 <CardTitle className="text-xs font-bold uppercase text-accent">Active Alerts</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                  {areaImpact[0] && (
                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border-l-4 border-red-500 shadow-sm">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold">{areaImpact[0].name} Critical</p>
                        <p className="text-[10px] text-muted-foreground">High concentration of priority 3 needs detected.</p>
                      </div>
                    </div>
                  )}
               </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
             <Tabs defaultValue="matches" className="space-y-8">
               <div className="flex justify-between items-center">
                 <TabsList className="grid w-full grid-cols-3 max-w-md h-12 bg-muted p-1 rounded-xl">
                   <TabsTrigger value="matches" className="rounded-lg data-[state=active]:shadow-sm">Smart Matches</TabsTrigger>
                   <TabsTrigger value="tasks" className="rounded-lg data-[state=active]:shadow-sm">Incident Feed</TabsTrigger>
                   <TabsTrigger value="volunteers" className="rounded-lg data-[state=active]:shadow-sm">Rescuers</TabsTrigger>
                 </TabsList>
                 {locationFilter !== 'all' && (
                   <Badge variant="secondary" className="gap-1 animate-in fade-in slide-in-from-right-2">
                     <MapPin className="h-3 w-3" /> Filtering: {locationFilter}
                   </Badge>
                 )}
               </div>

               <TabsContent value="matches" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {matches.length > 0 ? (
                     matches.filter(m => locationFilter === 'all' || m.reasons.some(r => r === "Geographic Proximity")).slice(0, 9).map((match, i) => (
                       <Card key={`${match.taskId}-${match.volunteerId}`} className="relative border-none shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 bg-card group">
                         <div className="absolute top-0 right-0 p-4">
                           <div className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
                             <Zap className="h-3 w-3" /> {match.score} Score
                           </div>
                         </div>
                         <CardHeader className="pb-2">
                           <CardTitle className="text-lg flex items-center gap-2 font-bold">
                             Match Recommendation
                           </CardTitle>
                           <CardDescription>Strategic pairing</CardDescription>
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
                               <Badge key={idx} variant="outline" className={cn(
                                 "text-[10px] bg-white/50",
                                 r === "Geographic Proximity" ? "border-accent text-accent font-bold" : "border-primary/20"
                               )}>
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
                       <p className="text-muted-foreground mt-1">Register more rescuers or tasks to see recommendations.</p>
                     </div>
                   )}
                 </div>
               </TabsContent>

               <TabsContent value="tasks" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {filteredTasks.map(task => (
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
                   {filteredTasks.length === 0 && (
                     <div className="col-span-full py-20 text-center text-muted-foreground">
                       No tasks found in {locationFilter}.
                     </div>
                   )}
                 </div>
               </TabsContent>

               <TabsContent value="volunteers" className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                   {sortedVolunteers.filter(v => locationFilter === 'all' || v.location === locationFilter).map(volunteer => (
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
