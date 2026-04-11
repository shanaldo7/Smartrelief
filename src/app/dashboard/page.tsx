"use client"

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { MapPin, Users, ClipboardList, CheckCircle2, Star, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string;
  location: string;
  urgency: "low" | "medium" | "high";
  priority: number;
  skillsRequired: string[];
  status: string;
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
  reason: string[];
  taskTitle: string;
  volunteerName: string;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qTasks = query(collection(db, "tasks"), orderBy("priority", "desc"), orderBy("createdAt", "desc"));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    const qVolunteers = query(collection(db, "volunteers"), orderBy("createdAt", "desc"));
    const unsubVolunteers = onSnapshot(qVolunteers, (snap) => {
      setVolunteers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Volunteer)));
      setLoading(false);
    });

    return () => {
      unsubTasks();
      unsubVolunteers();
    };
  }, []);

  useEffect(() => {
    if (tasks.length > 0 && volunteers.length > 0) {
      calculateMatches();
    }
  }, [tasks, volunteers]);

  const calculateMatches = () => {
    const newMatches: Match[] = [];
    
    // Sort tasks by priority (Numerical 3, 2, 1)
    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

    sortedTasks.forEach(task => {
      volunteers.forEach(volunteer => {
        let score = 0;
        const reasons: string[] = [];

        // Check skills (overlap)
        const matchedSkills = task.skillsRequired.filter(skill => 
          volunteer.skills.some(vSkill => vSkill.toLowerCase() === skill.toLowerCase())
        );
        if (matchedSkills.length > 0) {
          score += matchedSkills.length * 10;
          reasons.push(`${matchedSkills.length} skill match(es)`);
        }

        // Check location
        if (task.location.toLowerCase() === volunteer.location.toLowerCase()) {
          score += 20;
          reasons.push("Same location");
        }

        if (score > 0) {
          newMatches.push({
            taskId: task.id,
            volunteerId: volunteer.id,
            score: score + (task.priority * 5), // Task urgency boost
            reason: reasons,
            taskTitle: task.title,
            volunteerName: volunteer.name
          });
        }
      });
    });

    // Sort matches by combined score
    setMatches(newMatches.sort((a, b) => b.score - a.score).slice(0, 20));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold font-headline text-foreground">Community Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor tasks, volunteers, and potential matches in real-time.</p>
          </div>
          <div className="flex gap-3">
            <Badge variant="outline" className="px-3 py-1 bg-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> {tasks.length} Active Tasks
            </Badge>
            <Badge variant="outline" className="px-3 py-1 bg-white flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> {volunteers.length} Volunteers
            </Badge>
          </div>
        </header>

        <Tabs defaultValue="matches" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto h-12">
            <TabsTrigger value="matches" className="text-sm">Smart Matches</TabsTrigger>
            <TabsTrigger value="tasks" className="text-sm">Open Tasks</TabsTrigger>
            <TabsTrigger value="volunteers" className="text-sm">Volunteers</TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.length > 0 ? (
                matches.map((match, i) => (
                  <Card key={`${match.taskId}-${match.volunteerId}`} className="relative border-none shadow-md overflow-hidden hover:shadow-lg transition-shadow bg-white">
                    <div className="absolute top-0 right-0 p-3">
                      <div className="bg-accent/10 text-accent text-[10px] font-bold uppercase px-2 py-1 rounded-full flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Match Score: {match.score}
                      </div>
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-accent" />
                        Smart Recommendation
                      </CardTitle>
                      <CardDescription>Proposed pairing based on profile</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Task</p>
                        <p className="font-bold text-primary truncate">{match.taskTitle}</p>
                      </div>
                      <div className="p-3 bg-primary/5 rounded-lg border-l-4 border-primary">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Recommended Volunteer</p>
                        <p className="font-bold text-foreground">{match.volunteerName}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {match.reason.map((r, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] bg-secondary/50 font-medium">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-20 text-center">
                  <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                    <Star className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">No matches found yet</h3>
                  <p className="text-muted-foreground">Add more tasks or volunteers to see recommendations.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tasks.map(task => (
                <Card key={task.id} className="border-none shadow-md bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={cn(
                        "text-[10px] uppercase font-bold",
                        task.urgency === 'high' ? "bg-red-500 hover:bg-red-600" : 
                        task.urgency === 'medium' ? "bg-primary hover:bg-primary/90" : 
                        "bg-green-500 hover:bg-green-600"
                      )}>
                        {task.urgency} Priority
                      </Badge>
                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                        <MapPin className="h-3 w-3" /> {task.location}
                      </div>
                    </div>
                    <CardTitle className="text-xl font-bold font-headline leading-tight">{task.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">{task.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {task.skillsRequired.map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] font-normal border-primary/20 text-primary">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {volunteers.map(volunteer => (
                <Card key={volunteer.id} className="border-none shadow-md bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
                      <MapPin className="h-3 w-3 text-accent" /> {volunteer.location}
                    </div>
                    <CardTitle className="text-xl font-bold font-headline">{volunteer.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expertise</p>
                      <div className="flex flex-wrap gap-2">
                        {volunteer.skills.map((skill, idx) => (
                          <Badge key={idx} className="bg-accent/10 text-accent hover:bg-accent/20 border-none font-medium">
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
      </main>
    </div>
  );
}
