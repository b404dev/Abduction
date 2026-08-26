import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ViteConfig keeps the frontend build deliberately small and conventional.
export default defineConfig({ plugins: [react()] });
