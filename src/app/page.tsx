import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Users, MapPin, Zap, ShieldCheck, Activity, Globe, Target } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero');

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      <Navbar />
      <main className="flex-grow">
        <section className="relative py-24 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)] pointer-events-none" />
          <div className="container mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
            <div className="space-y-10 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-2xl border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Global Disaster Response Active</span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-foreground font-headline leading-[0.9] uppercase">
                SmartRelief <br />
                <span className="text-primary block mt-2">Precision Coordination.</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-[650px] font-bold leading-relaxed italic mx-auto lg:mx-0">
                The world's most intelligent disaster response infrastructure, connecting field NGO missions with vetted responders in seconds.
              </p>
              <div className="flex flex-wrap gap-6 justify-center lg:justify-start pt-4">
                <Button asChild size="lg" className="h-16 px-10 text-lg font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/30 group">
                  <Link href="/tasks/new" className="flex items-center gap-3">
                    Submit Field Mission
                    <Target className="h-5 w-5 group-hover:scale-125 transition-transform" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-16 px-10 text-lg font-black uppercase tracking-widest rounded-2xl border-2 group">
                  <Link href="/volunteers/new" className="flex items-center gap-3">
                    Enlist as Responder
                    <ShieldCheck className="h-5 w-5 group-hover:text-primary transition-colors" />
                  </Link>
                </Button>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-12 pt-8">
                <div className="text-center lg:text-left">
                  <p className="text-4xl font-black font-headline">24/7</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Operational Takt</p>
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-4xl font-black font-headline">500+</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Certified NGOs</p>
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-4xl font-black font-headline">1.2M</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Lives Impacted</p>
                </div>
              </div>
            </div>
            <div className="relative aspect-square md:aspect-video lg:aspect-square rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border-[12px] border-white dark:border-white/5 animate-in zoom-in-95 duration-1000">
              {heroImage && (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.description}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  priority
                  data-ai-hint={heroImage.imageHint}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-12">
                <div className="glass p-6 rounded-[2rem] max-w-sm w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live Sector Intel</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">Personnel currently deploying to West Bengal sector for emergency food relief.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-muted/30 py-32 px-4 border-y">
          <div className="container mx-auto">
            <div className="text-center mb-24 max-w-3xl mx-auto space-y-6">
              <Badge variant="outline" className="px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] border-2">Capabilities</Badge>
              <h2 className="text-5xl md:text-7xl font-black font-headline tracking-tighter uppercase leading-[0.9]">Response without <br /> Compromise.</h2>
              <p className="text-muted-foreground text-xl font-bold leading-relaxed italic italic">Our tactical infrastructure eliminates the friction between chaos and organized humanitarian support.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  title: "High-Confidence Matching",
                  desc: "Proprietary algorithms prioritize missions by urgency and geospatial proximity, connecting responders in seconds.",
                  icon: Zap,
                  color: "text-blue-600",
                  bg: "bg-blue-50"
                },
                {
                  title: "Multi-Agency Sync",
                  desc: "Direct data protocols with verified global NGOs ensure all field missions are legitimate, vetted, and high-impact.",
                  icon: ShieldCheck,
                  color: "text-primary",
                  bg: "bg-primary/5"
                },
                {
                  title: "Operational Mapping",
                  desc: "Next-generation geospatial analytics identify risk-density hubs to concentrate elite resources where they matter most.",
                  icon: MapPin,
                  color: "text-indigo-600",
                  bg: "bg-indigo-50"
                }
              ].map((feature, idx) => (
                <Card key={idx} className="border-2 shadow-sm hover:shadow-2xl transition-all duration-500 group rounded-[2.5rem] overflow-hidden">
                  <CardContent className="pt-16 pb-16 px-10 text-center space-y-8">
                    <div className={cn("inline-flex p-8 rounded-[2rem] transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6", feature.bg, feature.color)}>
                      <feature.icon className="h-12 w-12" />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-3xl font-black tracking-tight uppercase leading-none">{feature.title}</h3>
                      <p className="text-muted-foreground font-bold leading-relaxed italic">{feature.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-card py-20">
        <div className="container mx-auto px-4 grid md:grid-cols-2 lg:grid-cols-4 gap-16 items-start">
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="bg-primary p-2 rounded-xl">
                 <Zap className="h-6 w-6 text-primary-foreground" fill="currentColor" />
              </div>
              <span className="font-black text-3xl font-headline tracking-tighter uppercase">SmartRelief</span>
            </Link>
            <p className="text-sm font-bold text-muted-foreground leading-relaxed italic">
              Standardizing the world's disaster response data for a faster, more effective humanitarian future.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em]">Operational Links</h4>
            <div className="flex flex-col gap-4 text-sm font-bold text-muted-foreground">
              <Link href="/dashboard" className="hover:text-primary transition-colors uppercase tracking-widest">Command Center</Link>
              <Link href="/tasks/new" className="hover:text-primary transition-colors uppercase tracking-widest">Field Mission Portal</Link>
              <Link href="/volunteers/new" className="hover:text-primary transition-colors uppercase tracking-widest">Responder Registry</Link>
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em]">Security & Trust</h4>
            <div className="flex flex-col gap-4 text-sm font-bold text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors uppercase tracking-widest">NGO Verification</Link>
              <Link href="#" className="hover:text-primary transition-colors uppercase tracking-widest">Data Sovereignty</Link>
              <Link href="#" className="hover:text-primary transition-colors uppercase tracking-widest">Operational Security</Link>
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em]">Newsletter</h4>
            <div className="flex gap-2">
              <div className="h-12 bg-muted rounded-xl px-4 flex items-center text-sm font-bold text-muted-foreground w-full">Enter Email Address</div>
              <Button size="icon" className="h-12 w-12 rounded-xl">
                <Target className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-20 pt-8 border-t text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">© 2024 SmartRelief Strategic Ops. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}