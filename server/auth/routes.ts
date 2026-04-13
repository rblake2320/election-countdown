import type { Express } from "express";
import passport from "passport";
import { authStorage } from "./storage";
import { isAuthenticated, hashPassword } from "./localAuth";

export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Don't send password fields to client
      const { passwordHash, passwordSalt, ...safeUser } = user;
      return res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Register new account
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Check if user exists
      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const { hash, salt } = hashPassword(password);

      const user = await authStorage.upsertUser({
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash: hash,
        passwordSalt: salt,
        profileImageUrl: null,
      });

      // Auto-login after registration
      req.login(user, (err: any) => {
        if (err) {
          console.error("Login after registration error:", err);
          return res.status(500).json({ message: "Registration succeeded but login failed" });
        }
        const { passwordHash: _h, passwordSalt: _s, ...safeUser } = user;
        return res.status(201).json(safeUser);
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr: any) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
        }
        const { passwordHash: _h, passwordSalt: _s, ...safeUser } = user;
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      return res.json({ message: "Logged out" });
    });
  });

  // Keep GET /api/logout for backward compat (redirects to home)
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}
