import { ArrowRight, LayoutDashboard, Layers, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const features = [
  {
    icon: LayoutDashboard,
    title: "Intuitive Dashboard",
    description: "A clean, unified workspace that surfaces what matters most — no noise, no clutter.",
  },
  {
    icon: Layers,
    title: "Composable Architecture",
    description: "Built on a layered foundation. Swap, extend, or remove any piece without rewiring the rest.",
  },
  {
    icon: Zap,
    title: "Instant Performance",
    description: "Static-first builds ship zero dead JavaScript. Your users feel the difference on every load.",
  },
  {
    icon: Shield,
    title: "Type-Safe by Default",
    description: "TypeScript end-to-end with strict mode. Catch bugs at compile time, not in production.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 gap-6">
        <Badge variant="secondary" className="text-xs tracking-wide uppercase">
          Vite + React 19 + shadcn/ui
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight max-w-3xl leading-tight">
          A scaffold that ships{" "}
          <span className="text-primary">exactly what you need.</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl leading-relaxed">
          Start building immediately. Every component, token, and route is wired
          up and ready to extend. No boilerplate ceremony.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button size="lg" className="gap-2">
            Get started <ArrowRight className="size-4" />
          </Button>
          <Button variant="outline" size="lg">
            View source
          </Button>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 pb-24 max-w-5xl mx-auto w-full">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="gap-4">
              <CardHeader className="pb-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA / newsletter */}
      <section className="border-t bg-muted/40 px-6 py-20">
        <div className="mx-auto max-w-md text-center flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Stay in the loop</h2>
            <p className="text-muted-foreground text-sm">
              Drop your email and we'll let you know when new components land.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-left">
            <Label htmlFor="email">Email address</Label>
            <div className="flex gap-2">
              <Input id="email" type="email" placeholder="you@example.com" className="flex-1" />
              <Button type="button">Subscribe</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            No spam. Unsubscribe any time.
          </p>
        </div>
      </section>
    </div>
  );
}
