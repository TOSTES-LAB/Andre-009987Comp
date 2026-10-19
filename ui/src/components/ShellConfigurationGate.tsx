import { Outlet } from "@/lib/router";
import { AndrecompLoading } from "./AnimatedAndrecompIcon";

/** Keep shell selection stable while the independent access gate loads. */
export function ShellConfigurationGate({ loaded }: { loaded: boolean }) {
  return loaded ? <Outlet /> : <AndrecompLoading />;
}
