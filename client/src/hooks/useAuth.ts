import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import type { SessionResponse } from "@shared/auth";

interface Credentials {
  email: string;
  password: string;
}

interface RegisterPayload extends Credentials {
  name: string;
}

interface PlanSelection {
  importerQuota: number;
  exporterQuota: number;
  ncmQuota: number;
  billingCycle: "monthly" | "annual";
}

export function useAuth() {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery<SessionResponse | null>({
    queryKey: ["/api/auth/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const setSession = useCallback((session: SessionResponse | null) => {
    queryClient.setQueryData(["/api/auth/session"], session);
  }, [queryClient]);

  const loginMutation = useMutation<SessionResponse, Error, Credentials>({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/auth/login", payload);
      return res.json();
    },
    onSuccess: (session) => {
      setSession(session);
    },
  });

  const registerMutation = useMutation<SessionResponse, Error, RegisterPayload>({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/auth/register", payload);
      return res.json();
    },
    onSuccess: (session) => {
      setSession(session);
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      setSession(null);
    },
  });

  const subscribeMutation = useMutation<SessionResponse, Error, PlanSelection>({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/plans/subscribe", payload);
      return res.json();
    },
    onSuccess: (session) => {
      setSession(session);
    },
  });

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
  }, [queryClient]);

  return {
    session: sessionQuery.data,
    user: sessionQuery.data?.user ?? null,
    plan: sessionQuery.data?.plan ?? null,
    usage: sessionQuery.data?.usage ?? { importerUsed: 0, exporterUsed: 0, ncmUsed: 0 },
    isLoading: sessionQuery.isLoading,
    isFetching: sessionQuery.isFetching,
    error: sessionQuery.error as Error | null,
    login: loginMutation.mutateAsync,
    loginStatus: loginMutation.status,
    register: registerMutation.mutateAsync,
    registerStatus: registerMutation.status,
    logout: logoutMutation.mutateAsync,
    logoutStatus: logoutMutation.status,
    subscribe: subscribeMutation.mutateAsync,
    subscribeStatus: subscribeMutation.status,
    refresh,
  };
}
