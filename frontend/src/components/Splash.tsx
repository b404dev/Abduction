import { useEffect, useState } from "react";

type AbductionTarget = "code" | "cow" | "person";
type EncounterQuote = { quote: string; witness: string; detail: string };
const targets: AbductionTarget[] = ["code", "cow", "person"];
const quotes: EncounterQuote[] = [
  { quote: "All four of us looked down and saw a white Tic Tac object moving very abruptly over the water. As we pulled nose onto it, it rapidly accelerated in front of us and disappeared.", witness: "Cmdr. David Fravor, U.S. Navy", detail: "USS Nimitz encounter | 14 November 2004 | Congressional testimony" },
  { quote: "We began to detect unknown objects in our airspace. Initially dismissed as software glitches, we soon corroborated these radar tracks with infrared sensors, confirming their physical presence.", witness: "Lt. Ryan Graves, U.S. Navy", detail: "East Coast training ranges | 2014-2015 | Congressional testimony" },
];
const targetArt: Record<AbductionTarget, string> = {
  code: "  </>   { }   01  ",
  cow: "  (__ )  /\\\n  (oo) /  \\\n /|  |/    \\\n  || ||",
  person: "    O\n   /|\\\n   / \\",
};

export function Splash({ onComplete }: { onComplete: () => void }) {
  const [target] = useState<AbductionTarget>(() => targets[Math.floor(Math.random() * targets.length)]);
  const [encounter] = useState<EncounterQuote>(() => quotes[Math.floor(Math.random() * quotes.length)]);
  const [quoteVisible, setQuoteVisible] = useState(false);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealTimer = window.setTimeout(() => setQuoteVisible(true), reducedMotion ? 300 : 1600);
    const completeTimer = window.setTimeout(onComplete, reducedMotion ? 3000 : 5000);
    function handleStart(event: KeyboardEvent) { if (event.key === "Enter") onComplete(); }
    window.addEventListener("keydown", handleStart);
    return () => { window.clearTimeout(revealTimer); window.clearTimeout(completeTimer); window.removeEventListener("keydown", handleStart); };
  }, [onComplete]);
  return <main className="splash splash--ascii" aria-label={`Starting Abduction: abducting ${target}`} onClick={onComplete}>
    <div className="ascii-aurora" aria-hidden/>
    <div className="ascii-stars" aria-hidden>{"·    .        ✦              .        *\n       *            ·    .         +\n  .          +                 ·          .\n          ·        *       .          ✦\n *     .        ·       +        ."}</div>
    <pre className="ascii-moon" aria-hidden>{"    .-'''-.\n  .'  ·  . '.\n / .   ◦    ·\\\n|   ·    .   |\n \\  .  ·   /\n  '._   _.'\n     '''"}</pre>
    <pre className="ascii-craft" aria-hidden>{"                 .-''''''-.\n              .-'   .--.   '-.\n          ___/_____/____\\_____\\___\n       .-'                         '-.\n     .'_____o_____o_____o_____o_____o_'.\n    <___________________________________>\n      '._                           _.'\n          '---._______________,---'"}</pre>
    <div className="ascii-beam" aria-hidden><span>·░▒▓▒░·</span><span>░▒▓█▓▒░</span><span>·░▒▓▒░·</span><span>░▒▓█▓▒░</span><span>·░▒▓▒░·</span></div>
    <pre className={`ascii-target ascii-target--${target}`} aria-hidden>{targetArt[target]}</pre>
    <pre className="ascii-hills" aria-hidden>{"             __..---~~~~---..__                    __..--~~--..__\n      _..--''                    ''--..__    __..--'              '--.._"}</pre>
    <pre className="ascii-woods" aria-hidden>{"      /\\          /\\    /\\            /\\       /\\       /\\\n  /\\/▓▓\\ /\\    /▓▓\\  /▓▓\\   /\\    /▓▓\\ /\\  /▓▓\\     /▓▓\\\n /▓▓▓▓▓▓▓\\▓▓\\  /▓▓▓▓\\/▓▓▓▓\\ /▓▓\\  /▓▓▓▓▓▓▓\\/▓▓▓▓\\ /\\/▓▓▓▓\\\n   ||  ||   ||      ||    ||     ||      ||  ||   ||     ||  ||\n...||..||...||......||....||.....||......||..||...||.....||..||...\n^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^"}</pre>
    <div className="splash__identity"><h1>[ ABDUCTION ]</h1><p>{target === "code" ? "YOUR CODE HAS BEEN SELECTED" : `${target.toUpperCase()} ENCOUNTER IN PROGRESS`}</p><span>&gt; establishing repository contact_</span></div>
    {quoteVisible ? <section className="splash-encounter" aria-live="polite"><figure className="encounter-quote"><blockquote>&ldquo;{encounter.quote}&rdquo;</blockquote><figcaption><strong>{encounter.witness}</strong><span>{encounter.detail}</span></figcaption></figure><button type="button">Press Enter to start <span>or click anywhere · auto-starts in 3s</span></button></section> : null}
  </main>;
}
