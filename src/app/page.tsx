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
        <section className="relative py-32 px-4 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(46,138,184,0.1)_0%,transparent_70%)] pointer-events-none" />
          <div className="container mx-auto grid lg:grid-cols-2 gap-20 items-center relative z-10">
            <div className="space-y-12 text-center lg:text-left">
              <div className="inline-flex items-center gap-3 bg-primary/10 px-6 py-2.5 rounded-full border-2 border-primary/20">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Global Response Grid Active</span>
              </div>
              <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-foreground font-headline leading-[0.85] uppercase">
                Precision <br />
                <span className="text-primary block mt-4">Humanitarian.</span>
              </h1>
              <p className="text-xl md:text-3xl text-muted-foreground max-w-[700px] font-bold leading-tight italic mx-auto lg:mx-0">
                The world's most authoritative disaster response infrastructure, connecting elite NGO missions with certified responders in seconds.
              </p>
              <div className="flex flex-wrap gap-8 justify-center lg:justify-start pt-6">
                <Button asChild size="lg" className="h-20 px-12 text-xl font-black uppercase tracking-widest rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(46,138,184,0.4)] group">
                  <Link href="/dashboard" className="flex items-center gap-4">
                    Enter Command Center
                    <Target className="h-6 w-6 group-hover:scale-125 transition-transform" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-20 px-12 text-xl font-black uppercase tracking-widest rounded-[2rem] border-4 group">
                  <Link href="/volunteers/new" className="flex items-center gap-4 text-foreground">
                    Enlist Responder
                    <ShieldCheck className="h-6 w-6 group-hover:text-primary transition-colors" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="relative aspect-square rounded-[4rem] overflow-hidden shadow-[0_64px_128px_-32px_rgba(0,0,0,0.2)] border-[16px] border-white animate-in zoom-in-95 duration-1000">
              {heroImage && (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.description}
                  fill
                  className="object-cover"
                  priority
                  data-ai-hint={heroImage.imageHint}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-16">
                <div className="glass p-8 rounded-[3rem] max-w-md w-full">
                  <div className="flex items-center gap-4 mb-4">
                    <Globe className="h-6 w-6 text-primary" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary">Real-Time Intel</span>
                  </div>
                  <p className="text-lg font-black text-foreground uppercase leading-tight italic">Deployed units currently stabilizing critical sectors in the North-West corridor.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid: High Impact */}
        <section className="bg-white py-40 px-4 border-y-8 border-primary/10">
          <div className="container mx-auto">
            <div className="text-center mb-32 max-w-4xl mx-auto space-y-8">
              <Badge variant="outline" className="px-6 py-2 text-[10px] font-black uppercase tracking-[0.5em] border-4">Operational Standards</Badge>
              <h2 className="text-6xl md:text-8xl font-black font-headline tracking-tighter uppercase leading-[0.9]">Response Without <br /> Friction.</h2>
              <p className="text-muted-foreground text-2xl font-bold italic">Standardizing global humanitarian logistics through intelligent, geospatial coordination.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-16">
              {[
                {
                  title: "Smart Proximity",
                  desc: "Haversine-based tactical pathing connects the nearest qualified responders to high-urgency zones.",
                  icon: Zap,
                  bg: "bg-primary/10",
                  color: "text-primary"
                },
                {
                  title: "Vetted Missions",
                  desc: "Secure protocols with verified global NGOs ensure all field deployments are high-impact and legitimate.",
                  icon: ShieldCheck,
                  bg: "bg-accent/10",
                  color: "text-accent"
                },
                {
                  title: "Density Analytics",
                  desc: "Predictive heatmaps identify risk hubs, concentrating elite resources where they matter most.",
                  icon: MapPin,
                  bg: "bg-indigo-50",
                  color: "text-indigo-600"
                }
              ].map((feature, idx) => (
                <Card key={idx} className="border-4 shadow-xl hover:shadow-[0_48px_96px_-16px_rgba(0,0,0,0.15)] transition-all duration-700 group rounded-[3.5rem] overflow-hidden">
                  <CardContent className="pt-20 pb-20 px-12 text-center space-y-10">
                    <div className={cn("inline-flex p-10 rounded-[2.5rem] transition-all duration-500 group-hover:scale-110 group-hover:-rotate-12", feature.bg, feature.color)}>
                      <feature.icon className="h-16 w-16" />
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-4xl font-black tracking-tighter uppercase leading-none">{feature.title}</h3>
                      <p className="text-muted-foreground text-lg font-bold leading-relaxed italic">{feature.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-foreground text-white py-32">
        <div className="container mx-auto px-4 grid md:grid-cols-2 lg:grid-cols-4 gap-20 items-start">
          <div className="space-y-8">
            <Link href="/" className="flex items-center gap-4">
              <div className="bg-primary p-3 rounded-[1.5rem]">
                 <Zap className="h-8 w-8 text-white" fill="currentColor" />
              </div>
              <span className="font-black text-4xl font-headline tracking-tighter uppercase">SmartRelief</span>
            </Link>
            <p className="text-lg font-bold text-muted-foreground italic leading-relaxed">
              Establishing the global benchmark for disaster response coordination and data sovereignty.
            </p>
          </div>
          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Strategic Access</h4>
            <div className="flex flex-col gap-6 text-sm font-black uppercase tracking-widest text-muted-foreground">
              <Link href="/dashboard" className="hover:text-white transition-colors">Command Center</Link>
              <Link href="/tasks/new" className="hover:text-white transition-colors">Field Registry</Link>
              <Link href="/volunteers/new" className="hover:text-white transition-colors">Responder Enlistment</Link>
            </div>
          </div>
          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Operational Support</h4>
            <div className="flex flex-col gap-6 text-sm font-black uppercase tracking-widest text-muted-foreground">
              <Link href="#" className="hover:text-white transition-colors">NGO Protocols</Link>
              <Link href="#" className="hover:text-white transition-colors">Security Audit</Link>
              <Link href="#" className="hover:text-white transition-colors">Infrastructure Status</Link>
            </div>
          </div>
          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">HQ Updates</h4>
            <p className="text-sm font-bold text-muted-foreground italic mb-4">Receive tactical reports directly.</p>
            <div className="flex gap-4">
              <div className="h-14 bg-white/10 rounded-2xl px-6 flex items-center text-sm font-bold text-white w-full border-2 border-white/10">Email Signature</div>
              <Button size="icon" className="h-14 w-14 rounded-2xl bg-primary">
                <Target className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-32 pt-12 border-t border-white/10 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.6em] text-muted-foreground">© 2024 SmartRelief Strategic Operations. Vetted Deployment Authorized.</p>
        </div>
      </footer>
    </div>
  );
}