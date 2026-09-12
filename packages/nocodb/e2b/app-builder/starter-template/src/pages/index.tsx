// YOURS — the app's first screen, routed at "/" in src/routes.ts. Replace this
// placeholder with what the user actually asked for. Neither this file nor the
// src/pages folder is required by the platform; it is just where a screen
// conventionally lives.
export default function Index() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Your new app</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Describe what you'd like to build in the chat, and it'll take shape
        here.
      </p>
    </div>
  );
}
