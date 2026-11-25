export function tracingInstanceHost(env: NodeJS.ProcessEnv): string | undefined {
  if (env.ANDRECOMP_TRACING_INSTANCE_HOST !== "true" || !env.ANDRECOMP_PUBLIC_URL) return;
  const url = URL.parse(env.ANDRECOMP_PUBLIC_URL);
  if (url?.protocol === "https:" || url?.protocol === "http:") return url.hostname;
}
