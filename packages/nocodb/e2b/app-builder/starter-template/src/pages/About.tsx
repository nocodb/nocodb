import { Github, Twitter, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const stack = [
  { name: "Vite 6", role: "Build tooling" },
  { name: "React 19", role: "UI runtime" },
  { name: "TypeScript 5", role: "Type safety" },
  { name: "Tailwind CSS v4", role: "Styling" },
  { name: "shadcn/ui", role: "Component library" },
  { name: "react-router-dom v7", role: "Client routing" },
  { name: "lucide-react", role: "Icon set" },
];

export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 flex flex-col gap-12">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Badge variant="outline" className="w-fit">About this project</Badge>
        <h1 className="text-3xl font-bold tracking-tight">Built to last. Easy to change.</h1>
        <p className="text-muted-foreground leading-relaxed">
          This scaffold is an opinionated starting point for production-quality
          single-page apps. Every dependency was chosen deliberately — nothing
          is here for show, everything earns its place.
        </p>
      </div>

      <Separator />

      {/* Stack */}
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">The stack</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {stack.map(({ name, role }) => (
            <Card key={name} className="py-4 gap-2">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">{name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{role}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Links */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Connect</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Github className="size-4" /> GitHub
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Twitter className="size-4" /> Twitter
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Globe className="size-4" /> Website
          </Button>
        </div>
      </div>
    </div>
  );
}
