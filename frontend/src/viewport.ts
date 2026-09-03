// updateViewportUnits recomputes --vh/--vw as 1% of the true viewport divided
// by the active --scale, so viewport-unit CSS keeps its real-world proportions
// under the whole-app scale transform on .shell instead of measuring against
// the unscaled window.
export function updateViewportUnits() {
  const root = document.documentElement;
  const scale = Number(getComputedStyle(root).getPropertyValue("--scale")) || 1;
  root.style.setProperty("--vh", `${window.innerHeight / 100 / scale}px`);
  root.style.setProperty("--vw", `${window.innerWidth / 100 / scale}px`);
}
