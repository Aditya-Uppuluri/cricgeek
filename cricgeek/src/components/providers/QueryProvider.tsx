"use client";

import { useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { makeQueryClient } from "@/lib/query-client";

/**
 * SSR-safe localStorage wrapper.
 * Falls back to no-ops during server-side rendering so the persister
 * can be created once at module level without crashing.
 */
const safeStorage = {
  getItem: (key: string) =>
    typeof window !== "undefined" ? window.localStorage.getItem(key) : null,
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};

const persister = createSyncStoragePersister({
  storage: safeStorage,
  key: "cg-query-cache",
  throttleTime: 1000, // write to localStorage at most once per second
});

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // discard persisted cache older than 24h
        dehydrateOptions: {
          // Never persist live match data — it must always come from the network
          shouldDehydrateQuery: (query) =>
            query.queryKey[0] !== "liveMatches",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
