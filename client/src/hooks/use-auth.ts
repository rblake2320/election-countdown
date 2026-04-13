import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Lightweight client-side user shape.
 * When the real backend is running, we get full User objects.
 * When running as a static deploy, we simulate with localStorage.
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
  createdAt?: string | null;
  updatedAt?: string | null;
}

// ── Storage helpers (safe for sandboxed iframes) ──

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage blocked
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// ── EC-ID generator ──

const EC_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateEcId(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += EC_CHARS[Math.floor(Math.random() * EC_CHARS.length)];
  }
  return `EC-${code}`;
}

// ── Detect if backend API is available ──
// We check once per page load. The check must verify we get a REAL API
// response (JSON), not an HTML page from the hosting platform.

let backendAvailable: boolean | null = null;

async function checkBackend(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  try {
    const res = await fetch("/api/auth/user", {
      credentials: "include",
      signal: AbortSignal.timeout(2000),
    });
    // Must be a JSON API response. If the host returns HTML (e.g.
    // Perplexity's iframe host serving its own page), that's NOT our backend.
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      backendAvailable = false;
      return false;
    }
    backendAvailable = true;
    return true;
  } catch {
    backendAvailable = false;
    return false;
  }
}

// ── Server-mode functions (used when backend is running) ──

async function serverFetchUser(): Promise<ClientUser | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });
  if (response.status === 401) return null;
  if (!response.ok) return null;
  return response.json();
}

async function serverLogin(data: { email: string; password: string }): Promise<ClientUser> {
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

async function serverRegister(data: {
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

async function serverLogout(): Promise<void> {
  await fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });
}

// ── Local-mode functions (used when deployed as static site) ──

const LOCAL_USERS_KEY = "ec_users";
const LOCAL_SESSION_KEY = "ec_session";

function getLocalUsers(): Record<string, ClientUser & { passwordHash: string }> {
  const raw = safeGet(LOCAL_USERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLocalUsers(users: Record<string, ClientUser & { passwordHash: string }>) {
  safeSet(LOCAL_USERS_KEY, JSON.stringify(users));
}

// Simple hash for local-only password checking (NOT secure — demo only)
async function simpleHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "ec_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function localFetchUser(): ClientUser | null {
  const sessionEmail = safeGet(LOCAL_SESSION_KEY);
  if (!sessionEmail) return null;
  const users = getLocalUsers();
  const entry = users[sessionEmail];
  if (!entry) {
    safeRemove(LOCAL_SESSION_KEY);
    return null;
  }
  // Strip password hash before returning
  const { passwordHash, ...user } = entry;
  return user;
}

async function localLogin(data: { email: string; password: string }): Promise<ClientUser> {
  const users = getLocalUsers();
  const key = data.email.toLowerCase().trim();
  const entry = users[key];
  if (!entry) {
    throw new Error("No account found with that email. Please create an account first.");
  }
  const hash = await simpleHash(data.password);
  if (hash !== entry.passwordHash) {
    throw new Error("Incorrect password. Please try again.");
  }
  safeSet(LOCAL_SESSION_KEY, key);
  const { passwordHash, ...user } = entry;
  return user;
}

async function localRegister(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<ClientUser> {
  const users = getLocalUsers();
  const key = data.email.toLowerCase().trim();
  if (users[key]) {
    throw new Error("An account with that email already exists. Please sign in.");
  }
  const hash = await simpleHash(data.password);
  const now = new Date().toISOString();
  const newUser: ClientUser & { passwordHash: string } = {
    id: crypto.randomUUID?.() || `local_${Date.now()}`,
    ecId: generateEcId(),
    email: data.email,
    phone: null,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    profileImageUrl: null,
    emailVerified: false,
    phoneVerified: false,
    isFullyVerified: false,
    verifiedAt: null,
    trustScore: 0,
    flaggedAsBot: false,
    createdAt: now,
    updatedAt: now,
    passwordHash: hash,
  };
  users[key] = newUser;
  saveLocalUsers(users);
  safeSet(LOCAL_SESSION_KEY, key);
  const { passwordHash: _, ...user } = newUser;
  return user;
}

function localLogout() {
  // Only remove the session pointer — NOT the user accounts store
  safeRemove(LOCAL_SESSION_KEY);
}

// ── Combined fetch / login / register / logout ──

async function fetchUser(): Promise<ClientUser | null> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      return await serverFetchUser();
    } catch {
      return null;
    }
  }
  return localFetchUser();
}

async function loginFn(data: { email: string; password: string }): Promise<ClientUser> {
  const hasBackend = await checkBackend();
  if (hasBackend) return serverLogin(data);
  return localLogin(data);
}

async function registerFn(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<ClientUser> {
  const hasBackend = await checkBackend();
  if (hasBackend) return serverRegister(data);
  return localRegister(data);
}

async function logoutFn(): Promise<void> {
  const hasBackend = await checkBackend();
  if (hasBackend) {
    try {
      await serverLogout();
    } catch {}
  }
  localLogout();
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
