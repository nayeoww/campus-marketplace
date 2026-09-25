import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";

/**
 * The signed-in student: account flags, verification state and profile.
 * Everything the marketplace gate needs in one reactive query.
 */
export function useCampusUser() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.profiles.me);

  return {
    isLoading: authLoading || (isAuthenticated && me === undefined),
    isAuthenticated,
    me,
    canTrade: Boolean(me?.canTrade),
    profileComplete: Boolean(me?.profile),
  };
}
