import { installMockRuntime } from "./mock-backend";

if (new URL(window.location.href).searchParams.get("fresh") === "1") localStorage.clear();
installMockRuntime();

await import("../src/main");
