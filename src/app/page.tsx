import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Users, MapPin, Zap } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <section className="relative py-20 px-4">
          <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-foreground font-headline">
                Connecting Hearts, <br />
                <span className="text-primary">Building Community.</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-[600px]">
                Kindred Connect is a smart volunteer matching platform that pairs dedicated people with the causes that need them most.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button asChild size="lg" className="px-8 bg-primary hover:bg-primary/90">
                  <Link href="/tasks/new">I Need Help</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="px-8 border-primary text-primary hover:bg-primary/10">
                  <Link href="/volunteers/new">I Want to Volunteer</Link>
                </Button>
              </div>
            </div>
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
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

        <section className="bg-secondary/30 py-20 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold font-headline mb-4">How Kindred Connect Works</h2>
              <p className="text-muted-foreground">Efficiency meets empathy in our matching algorithm.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Smart Matching",
                  desc: "Our AI-powered system analyzes skills and location to find the perfect volunteer for every task.",
                  icon: Zap,
                  color: "text-accent"
                },
                {
                  title: "Priority Driven",
                  desc: "Critical needs are addressed first, ensuring urgent support gets to those who need it immediately.",
                  icon: Heart,
                  color: "text-primary"
                },
                {
                  title: "Community First",
                  desc: "We prioritize local connections to build stronger, more resilient neighborhood bonds.",
                  icon: MapPin,
                  color: "text-blue-500"
                }
              ].map((feature, idx) => (
                <Card key={idx} className="border-none shadow-md hover:shadow-lg transition-shadow bg-background">
                  <CardContent className="pt-8 text-center space-y-4">
                    <div className={cn("inline-flex p-3 rounded-2xl bg-muted", feature.color)}>
                      <feature.icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-background py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="font-bold text-lg font-headline">Kindred Connect</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2024 Kindred Connect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

import { cn } from "@/lib/utils";
