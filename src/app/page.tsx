import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Users, MapPin, Zap, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <section className="relative py-20 px-4">
          <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                Real-time Disaster Response
              </Badge>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground font-headline">
                SmartRelief <br />
                <span className="text-primary">Response at Scale.</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-[600px]">
                A intelligent coordination platform that matches skilled volunteers with high-priority NGO tasks in disaster zones.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="px-8 h-14 text-lg">
                  <Link href="/tasks/new">Submit a Need</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="px-8 h-14 text-lg">
                  <Link href="/volunteers/new">Register to Help</Link>
                </Button>
              </div>
            </div>
            <div className="relative aspect-square md:aspect-video rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
              {heroImage && (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.description}
                  fill
                  className="object-cover"
                  data-ai-hint={heroImage.imageHint}
                />
              )}
            </div>
          </div>
        </section>

        <section className="bg-muted/50 py-24 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-20 max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold font-headline mb-4">Precision Relief Coordination</h2>
              <p className="text-muted-foreground text-lg">We bridge the gap between chaos and organized support using data-driven matching.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  title: "Rapid Matching",
                  desc: "Algorithms prioritize tasks by urgency and proximity, connecting volunteers in seconds.",
                  icon: Zap,
                  color: "text-amber-500",
                  bg: "bg-amber-50"
                },
                {
                  title: "NGO Integration",
                  desc: "Direct data imports from verified NGOs ensure tasks are legitimate and vetted for safety.",
                  icon: ShieldCheck,
                  color: "text-primary",
                  bg: "bg-primary/5"
                },
                {
                  title: "Geospatial Focus",
                  desc: "Map-based tracking identifies the most affected areas to concentrate resources effectively.",
                  icon: MapPin,
                  color: "text-emerald-500",
                  bg: "bg-emerald-50"
                }
              ].map((feature, idx) => (
                <Card key={idx} className="border-none shadow-sm hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="pt-10 pb-10 text-center space-y-6">
                    <div className={cn("inline-flex p-5 rounded-3xl transition-transform group-hover:scale-110", feature.bg, feature.color)}>
                      <feature.icon className="h-10 w-10" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1 rounded-md">
               <Zap className="h-4 w-4 text-primary-foreground" fill="currentColor" />
            </div>
            <span className="font-bold text-xl font-headline">SmartRelief</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-muted-foreground">
            <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
            <Link href="/tasks/new" className="hover:text-primary transition-colors">NGO Portal</Link>
            <Link href="/volunteers/new" className="hover:text-primary transition-colors">Volunteer Center</Link>
          </div>
          <p className="text-sm text-muted-foreground">© 2024 SmartRelief. Humanitarian Data Platform.</p>
        </div>
      </footer>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
