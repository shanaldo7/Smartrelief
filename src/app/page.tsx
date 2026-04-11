import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, ShieldCheck, Activity, Globe, Target, MapPin, Users } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero');

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Navbar />
      <main className="flex-grow">
        {/* Authority Hero Section */}
        <section className="relative py-24 md:py-32 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(46,138,184,0.05)_0%,transparent_70%)] pointer-events-none" />
          <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10 max-w-[1200px]">
            <div className="space-y-10 text-center lg:text-left">
              <div className="inline-flex items-center gap-3 bg-primary/10 px-5 py-2 rounded-full border border-primary/20">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary">Global Response Grid Active</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-foreground font-headline leading-[0.95] uppercase">
                Precision <br />
                <span className="text-primary block mt-2">Relief Effort.</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] font-medium leading-relaxed italic mx-auto lg:mx-0">
                The strategic infrastructure for modern disaster response, connecting NGOs with certified responders in real-time.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-4">
                <Button asChild size="lg" className="h-16 px-10 text-sm font-bold uppercase tracking-widest rounded-xl shadow-xl hover:shadow-2xl transition-all group">
                  <Link href="/dashboard" className="flex items-center gap-3">
                    Command Center
                    <Target className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-16 px-10 text-sm font-bold uppercase tracking-widest rounded-xl border-2 group">
                  <Link href="/volunteers/new" className="flex items-center gap-3 text-foreground">
                    Enlist Now
                    <ShieldCheck className="h-5 w-5 group-hover:text-primary transition-colors" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-8 border-white group">
              {heroImage && (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.description}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                  data-ai-hint={heroImage.imageHint}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-8">
                <div className="glass p-6 rounded-2xl max-w-xs w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Real-Time Data</span>
                  </div>
                  <p className="text-sm font-bold text-foreground uppercase leading-tight italic">Active units deployed in the coastal sectors.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid: High Impact */}
        <section className="bg-white py-32 px-4 border-y">
          <div className="container mx-auto max-w-[1200px]">
            <div className="text-center mb-24 max-w-3xl mx-auto space-y-6">
              <Badge variant="outline" className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest border-2">Operational Protocol</Badge>
              <h2 className="text-4xl md:text-5xl font-black font-headline tracking-tight uppercase leading-tight">Response Without Friction.</h2>
              <p className="text-muted-foreground text-xl font-medium italic">Standardizing global humanitarian coordination through intelligent logic.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  title: "Smart Proximity",
                  desc: "Precision pathing connects qualified responders to urgent zones instantly.",
                  icon: Zap,
                  bg: "bg-primary/5",
                  color: "text-primary"
                },
                {
                  title: "Vetted Missions",
                  desc: "Secure protocols with verified NGOs ensure all deployments are legitimate.",
                  icon: ShieldCheck,
                  bg: "bg-accent/5",
                  color: "text-accent"
                },
                {
                  title: "Density Maps",
                  desc: "Live heatmaps identify risk hubs, concentrating resources where they matter.",
                  icon: MapPin,
                  bg: "bg-indigo-50/50",
                  color: "text-indigo-500"
                }
              ].map((feature, idx) => (
                <Card key={idx} className="border-2 shadow-sm hover:shadow-md transition-all group rounded-3xl overflow-hidden">
                  <CardContent className="pt-12 pb-12 px-8 text-center space-y-8">
                    <div className={cn("inline-flex p-8 rounded-2xl transition-all duration-500 group-hover:scale-110", feature.bg, feature.color)}>
                      <feature.icon className="h-10 w-10" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black tracking-tight uppercase">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm font-medium leading-relaxed italic">{feature.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-foreground text-white py-24">
        <div className="container mx-auto px-4 grid md:grid-cols-2 lg:grid-cols-4 gap-16 items-start max-w-[1200px]">
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg">
                 <Zap className="h-6 w-6 text-white" fill="currentColor" />
              </div>
              <span className="font-black text-2xl font-headline tracking-tight uppercase">SmartRelief</span>
            </Link>
            <p className="text-sm font-medium text-muted-foreground italic leading-relaxed">
              The benchmark for global disaster response coordination and strategic data management.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Strategic Access</h4>
            <div className="flex flex-col gap-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Link href="/dashboard" className="hover:text-white transition-colors">Command Center</Link>
              <Link href="/tasks/new" className="hover:text-white transition-colors">Request Field Aid</Link>
              <Link href="/volunteers/new" className="hover:text-white transition-colors">Join Responders</Link>
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Operational Support</h4>
            <div className="flex flex-col gap-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Link href="#" className="hover:text-white transition-colors">NGO Protocols</Link>
              <Link href="#" className="hover:text-white transition-colors">Security Audit</Link>
              <Link href="#" className="hover:text-white transition-colors">Infra Status</Link>
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">HQ Updates</h4>
            <p className="text-[11px] font-medium text-muted-foreground italic">Receive tactical intelligence.</p>
            <div className="flex gap-2">
              <div className="h-11 bg-white/5 rounded-xl px-4 flex items-center text-[10px] font-bold text-white w-full border border-white/10">Email Signature</div>
              <Button size="icon" className="h-11 w-11 rounded-xl bg-primary flex-shrink-0">
                <Target className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
