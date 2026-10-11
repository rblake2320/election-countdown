import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Preferences } from "@/lib/themes";

/**
 * Lightweight client-side user shape.
 * The API is the only source of truth; there is no localStorage account fallback.
 * (A local fallback once created fake, unsynced accounts when the API was slow.)
 */
interface ClientUser {
  id: string;
  ecId?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  isFullyVerified: boolean;
  verifiedAt?: string | null;
  trustScore: number;
  flaggedAsBot: boolean;
  preferences?: Preferences;
  createdAt?: string | null;
  updatedAt?: string | null;
}


// ── API calls ──

async function fetchUser(): Promise<ClientUser | null> {
  try {
    const response = await fetch("/api/auth/user", { credentials: "include" });
    if (response.status === 401 || !response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function loginFn(data: { email: string; password: string }): Promise<ClientUser> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Login failed" }));
    throw new Error(error.message || "Login failed");
  }
  return response.json();
}

async function registerFn(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<ClientUser> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Registration failed" }));
    throw new Error(error.message || "Registration failed");
  }
  return response.json();
}

async function logoutFn(): Promise<void> {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
  } catch {}
}


// ── Hook ──

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<ClientUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation({
    mutationFn: loginFn,
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerFn,
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutFn,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      // Also clear any cached intent/verify queries
      queryClient.invalidateQueries({ queryKey: ["/api/intent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/verify/status"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error?.message || null,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error?.message || null,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
