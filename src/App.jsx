import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const TICK_MS = 250;
const IDLE = { kind: "idle" };

function uidHue(uid) {
  const n = Number(uid || 0);
  return (n * 47) % 360;
}

function uidColor(uid) {
  const h = uidHue(uid);
  return `hsl(${h} 70% 55%)`;
}

function uidColorA(uid, a) {
  const h = uidHue(uid);
  return `hsla(${h} 70% 55% / ${a})`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  return `${s.toFixed(s < 10 ? 2 : 1)}s`;
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function Pill({ children, tone = "neutral" }) {
  const bg =
    tone === "good"
      ? "rgba(34,197,94,0.16)"
      : tone === "warn"
        ? "rgba(245,158,11,0.18)"
        : tone === "bad"
          ? "rgba(239,68,68,0.16)"
          : "rgba(148,163,184,0.14)";
  const bd =
    tone === "good"
      ? "rgba(34,197,94,0.40)"
      : tone === "warn"
        ? "rgba(245,158,11,0.40)"
        : tone === "bad"
          ? "rgba(239,68,68,0.40)"
          : "rgba(148,163,184,0.32)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.2rem 0.6rem",
        borderRadius: 999,
        border: `1px solid ${bd}`,
        background: bg,
        fontSize: "0.86rem",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function MiniButton({
  children,
  onClick,
  disabled,
  title,
  kind = "neutral",
  hot = false,
}) {
  const styles = {
    neutral: {
      background: "rgba(148,163,184,0.14)",
      border: "1px solid rgba(148,163,184,0.36)",
    },
    primary: {
      background: "rgba(59,130,246,0.20)",
      border: "1px solid rgba(59,130,246,0.46)",
    },
    danger: {
      background: "rgba(239,68,68,0.16)",
      border: "1px solid rgba(239,68,68,0.44)",
    },
  }[kind];

  return (
    <button
      className={hot ? "ui-hot" : ""}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...styles,
        color: "rgba(226,232,240,0.98)",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "0.55rem 0.85rem",
        borderRadius: 12,
        fontSize: "0.92rem",
        fontWeight: 750,
        opacity: disabled ? 0.55 : 1,
        transition:
          "transform 140ms ease, filter 140ms ease, opacity 140ms ease",
      }}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  right,
  children,
  dim = false,
  onInteract,
  accent = "neutral",
}) {
  return (
    <div
      className={dim ? "card card-dim" : "card"}
      onMouseEnter={onInteract}
      onPointerDown={onInteract}
      style={{
        borderColor:
          accent === "warn"
            ? "rgba(245,158,11,0.34)"
            : accent === "bad"
              ? "rgba(239,68,68,0.34)"
              : accent === "good"
                ? "rgba(34,197,94,0.30)"
                : "rgba(148,163,184,0.22)",
      }}
    >
      <div className="card-head">
        <div className="card-title">{title}</div>
        {right}
      </div>
      <div style={{ marginTop: "0.85rem" }}>{children}</div>
    </div>
  );
}

function ProgressBar({ value, max = 100 }) {
  const pct = max === 0 ? 0 : clamp((value / max) * 100, 0, 100);
  return (
    <div className="bar-shell">
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Timeline({ slices, maxSlices = 72 }) {
  const shown = slices.slice(-maxSlices);
  return (
    <div className="timeline" aria-label="CPU timeline">
      {shown.map((s, idx) => (
        <div
          key={idx}
          title={s.kind === "idle" ? "idle" : `${s.name} (uid ${s.uid})`}
          style={{
            borderRadius: 6,
            background:
              s.kind === "idle" ? "rgba(148,163,184,0.20)" : uidColor(s.uid),
            opacity: s.kind === "idle" ? 0.55 : 0.95,
          }}
        />
      ))}
    </div>
  );
}

function EmptyHint({ children }) {
  return <div className="empty-hint">{children}</div>;
}

function CpuGraph({
  cpuCount,
  runningByCpu,
  entangledPair,
  entanglementOk,
  selectedCpu,
  onSelectCpu,
}) {
  const width = 980;
  const height = 230;
  const padX = 70;
  const y = 90;

  const points = Array.from({ length: cpuCount }, (_, i) => {
    const x =
      cpuCount === 1
        ? width / 2
        : padX + (i * (width - padX * 2)) / (cpuCount - 1);
    return { i, x, y };
  });

  const entLine = (() => {
    if (!entangledPair) return null;
    const [a, b] = entangledPair;
    const pa = points.find((p) => p.i === a);
    const pb = points.find((p) => p.i === b);
    if (!pa || !pb) return null;
    return { pa, pb };
  })();

  return (
    <div className="graph-shell" aria-label="CPU graph">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="entGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(245,158,11,0.85)" />
            <stop offset="1" stopColor="rgba(168,85,247,0.85)" />
          </linearGradient>
        </defs>

        <line
          x1={padX}
          y1={y}
          x2={width - padX}
          y2={y}
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="3"
        />

        {entLine && (
          <g filter="url(#glow)">
            <path
              d={`M ${entLine.pa.x} ${entLine.pa.y} C ${(entLine.pa.x + entLine.pb.x) / 2} ${entLine.pa.y - 55}, ${(entLine.pa.x + entLine.pb.x) / 2} ${entLine.pb.y - 55}, ${entLine.pb.x} ${entLine.pb.y}`}
              fill="none"
              stroke={entanglementOk ? "url(#entGrad)" : "rgba(239,68,68,0.95)"}
              strokeWidth={8}
              strokeLinecap="round"
              opacity={0.95}
            />
            <text
              x={(entLine.pa.x + entLine.pb.x) / 2}
              y={entLine.pa.y - 62}
              textAnchor="middle"
              fontSize="14"
              fill={
                entanglementOk
                  ? "rgba(245,158,11,0.95)"
                  : "rgba(239,68,68,0.95)"
              }
              style={{ fontWeight: 800 }}
            >
              entangled
            </text>
          </g>
        )}

        {points.map((p) => {
          const t = runningByCpu[p.i] || IDLE;
          const isIdle = t.kind === "idle";
          const fill = isIdle
            ? "rgba(148,163,184,0.16)"
            : uidColorA(t.uid, 0.92);
          const stroke = isIdle
            ? "rgba(148,163,184,0.32)"
            : uidColorA(t.uid, 0.95);
          const ring =
            entangledPair &&
            (p.i === entangledPair[0] || p.i === entangledPair[1]);

          const isSelected = selectedCpu === p.i;
          return (
            <g
              key={p.i}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCpu?.(p.i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectCpu?.(p.i);
              }}
              style={{ cursor: "pointer" }}
            >
              <title>Click CPU {p.i} to explain what is happening</title>
              {isSelected && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={44}
                  fill="none"
                  stroke="rgba(59,130,246,0.55)"
                  strokeWidth={6}
                  opacity={0.9}
                />
              )}
              {ring && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={34}
                  fill="none"
                  stroke="rgba(245,158,11,0.40)"
                  strokeWidth="4"
                  opacity={0.95}
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={26}
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
                opacity={0.98}
              />
              <text
                x={p.x}
                y={p.y + 5}
                textAnchor="middle"
                fontSize="14"
                fill="rgba(226,232,240,0.95)"
                style={{ fontWeight: 900 }}
              >
                CPU {p.i}
              </text>
              <text
                x={p.x}
                y={p.y + 46}
                textAnchor="middle"
                fontSize="12"
                fill="rgba(226,232,240,0.72)"
                style={{ fontWeight: 700 }}
              >
                {isIdle ? "idle" : `uid ${t.uid}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CpuExplain({
  cpuIdx,
  entangledPair,
  entanglementStatus,
  anyRunnable,
  cpuState,
  runningTasksByCpu,
  tasks,
  onClose,
}) {
  if (cpuIdx == null) return null;

  const cpu = cpuState[cpuIdx];
  const rt = runningTasksByCpu[cpuIdx] || IDLE;
  if (!cpu) return null;
  const isEntangled =
    entangledPair &&
    (cpuIdx === entangledPair[0] || cpuIdx === entangledPair[1]);
  const partner = isEntangled
    ? cpuIdx === entangledPair[0]
      ? entangledPair[1]
      : entangledPair[0]
    : null;

  const idleBad = anyRunnable && (cpu?.idleStreakMs || 0) >= 10_000;
  const idleWarn = anyRunnable && (cpu?.idleStreakMs || 0) > 0 && !idleBad;

  const task = rt?.kind === "idle" ? null : tasks.find((t) => t.id === rt.id);

  const tone = idleBad
    ? "bad"
    : entanglementStatus?.ok
      ? rt?.kind === "idle"
        ? idleWarn
          ? "warn"
          : "neutral"
        : "good"
      : "bad";

  const headline = idleBad
    ? "Idle too long"
    : rt?.kind === "idle"
      ? "Idle"
      : "Running";

  const why = idleBad
    ? "Work exists, but this CPU stayed idle for 10 seconds."
    : rt?.kind === "idle"
      ? anyRunnable
        ? "Work exists. If this stays idle for 10 seconds, it becomes a rule violation."
        : "No runnable work right now, so idling is fine."
      : "A runnable task is assigned here this tick.";

  const lockLine = !entangledPair
    ? "No entanglement is active right now."
    : isEntangled
      ? entanglementStatus?.ok
        ? `Linked with CPU ${partner}. Their uid colors must match.`
        : `Linked with CPU ${partner}. Different uid colors means the lock is broken.`
      : `Entanglement exists between CPU ${entangledPair[0]} and CPU ${entangledPair[1]}. This CPU is not linked.`;

  const tryLine =
    rt?.kind === "idle"
      ? "Try: add a task, or unblock a task, then watch the colors change."
      : "Try: block this task to force a visible change.";

  return (
    <div
      className={`explain explain-${tone}`}
      role="region"
      aria-label={`CPU ${cpuIdx} explanation`}
    >
      <div className="explain-head">
        <div className="explain-left">
          <div className="explain-title">CPU {cpuIdx}</div>
          <Pill tone={tone}>{headline}</Pill>
          {isEntangled ? <Pill tone="warn">linked</Pill> : <Pill>normal</Pill>}
          {rt?.kind === "idle" ? (
            <Pill tone={idleBad ? "bad" : idleWarn ? "warn" : "neutral"}>
              idle {fmtMs(cpu?.idleStreakMs || 0)}
            </Pill>
          ) : (
            <Pill tone="good">running</Pill>
          )}
        </div>

        <button
          className="xbtn"
          onClick={onClose}
          title="Close explanation"
          aria-label="Close explanation"
        >
          ×
        </button>
      </div>

      <div className="explain-grid">
        <div className="explain-cell">
          <div className="explain-label">Why</div>
          <div className="explain-text">{why}</div>
        </div>
        <div className="explain-cell">
          <div className="explain-label">Lock</div>
          <div className="explain-text">{lockLine}</div>
        </div>
        <div className="explain-cell">
          <div className="explain-label">Try this</div>
          <div className="explain-text">{tryLine}</div>
        </div>
      </div>

      {task && (
        <div className="explain-task">
          <div className="explain-task-head">
            <span className="dot" style={{ background: uidColor(task.uid) }} />
            <div style={{ fontWeight: 900 }}>{task.name}</div>
            <div style={{ opacity: 0.78 }}>uid {task.uid}</div>
          </div>
          <ProgressBar value={task.ranMs} max={task.ranMs + task.remainingMs} />
        </div>
      )}

      <div className="explain-tip">
        Tip: click another CPU to compare. Watching colors change teaches
        fastest.
      </div>
    </div>
  );
}

export default function App() {
  const [cpuCount, setCpuCount] = useState(4);
  const [entangledA, setEntangledA] = useState(1);
  const [entangledB, setEntangledB] = useState(3);

  const [tasks, setTasks] = useState(() => [
    {
      id: makeId(),
      name: "alice: build",
      uid: 1000,
      runnable: true,
      remainingMs: 9000,
      createdAtMs: 0,
      ranMs: 0,
    },
    {
      id: makeId(),
      name: "bob: test",
      uid: 1001,
      runnable: true,
      remainingMs: 9000,
      createdAtMs: 0,
      ranMs: 0,
    },
    {
      id: makeId(),
      name: "alice: docs",
      uid: 1000,
      runnable: true,
      remainingMs: 6000,
      createdAtMs: 0,
      ranMs: 0,
    },
  ]);

  const [nowMs, setNowMs] = useState(0);
  const [running, setRunning] = useState(false);

  const [selectedCpu, setSelectedCpu] = useState(null);
  const [hasPickedCpu, setHasPickedCpu] = useState(false);

  const [seen, setSeen] = useState({
    quick: false,
    controls: false,
    cpu: false,
    tasks: false,
  });
  const touch = (k) => setSeen((p) => (p[k] ? p : { ...p, [k]: true }));

  const [cpuState, setCpuState] = useState(() =>
    Array.from({ length: 4 }, () => ({
      taskId: null,
      idleStreakMs: 0,
      timeline: [],
    })),
  );

  const intervalRef = useRef(null);

  useEffect(() => {
    setCpuState((prev) => {
      const next = [...prev];
      if (next.length < cpuCount)
        while (next.length < cpuCount)
          next.push({ taskId: null, idleStreakMs: 0, timeline: [] });
      else if (next.length > cpuCount) next.length = cpuCount;
      return next;
    });
    setSelectedCpu((prev) => {
      if (prev == null) return prev;
      if (prev >= cpuCount) return cpuCount - 1;
      if (prev < 0) return 0;
      return prev;
    });
    setEntangledA((v) => clamp(Number(v) || 0, 0, Math.max(0, cpuCount - 1)));
    setEntangledB((v) => clamp(Number(v) || 0, 0, Math.max(0, cpuCount - 1)));
  }, [cpuCount]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      stepScheduler();
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, cpuCount, entangledA, entangledB, tasks, cpuState, nowMs]);

  const runnableTasks = useMemo(
    () => tasks.filter((t) => t.runnable && t.remainingMs > 0),
    [tasks],
  );

  const runnableByUid = useMemo(() => {
    const m = new Map();
    for (const t of runnableTasks) {
      const k = String(t.uid);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return m;
  }, [runnableTasks]);

  const entangledPair = useMemo(() => {
    const a = Number(entangledA);
    const b = Number(entangledB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (a === b) return null;
    if (a < 0 || b < 0) return null;
    if (a >= cpuCount || b >= cpuCount) return null;
    return [a, b];
  }, [entangledA, entangledB, cpuCount]);

  const runningTasksByCpu = useMemo(() => {
    return cpuState.map((c) => {
      if (!c.taskId) return IDLE;
      const t = tasks.find((x) => x.id === c.taskId);
      return t || IDLE;
    });
  }, [cpuState, tasks]);

  const anyRunnable = runnableTasks.length > 0;

  const idleViolations = useMemo(() => {
    if (!anyRunnable) return [];
    const v = [];
    for (let i = 0; i < cpuState.length; i++)
      if (cpuState[i].idleStreakMs >= 10_000) v.push(i);
    return v;
  }, [cpuState, anyRunnable]);

  const entanglementStatus = useMemo(() => {
    if (!entangledPair) return { ok: true, reason: "No entanglement." };
    const [x, y] = entangledPair;
    const tx = runningTasksByCpu[x];
    const ty = runningTasksByCpu[y];
    if (tx.kind === "idle" || ty.kind === "idle")
      return { ok: true, reason: "One side idle." };
    if (tx.uid === ty.uid) return { ok: true, reason: `Same uid ${tx.uid}.` };
    return { ok: false, reason: `Mismatch uid ${tx.uid} vs ${ty.uid}.` };
  }, [entangledPair, runningTasksByCpu]);

  const dynamicBg = useMemo(() => {
    const uids = [
      ...new Set(
        runningTasksByCpu.filter((t) => t.kind !== "idle").map((t) => t.uid),
      ),
    ];
    const layers = [];
    const anchors = [
      ["12%", "18%"],
      ["85%", "20%"],
      ["20%", "85%"],
      ["78%", "82%"],
      ["52%", "55%"],
    ];
    for (let i = 0; i < Math.min(uids.length, anchors.length); i++) {
      const [x, y] = anchors[i];
      layers.push(
        `radial-gradient(900px 520px at ${x} ${y}, ${uidColorA(uids[i], 0.22)}, transparent 60%)`,
      );
    }
    layers.push(
      "radial-gradient(1200px 700px at 10% 10%, rgba(59,130,246,0.16), transparent 58%)",
    );
    layers.push(
      "radial-gradient(900px 560px at 90% 18%, rgba(168,85,247,0.12), transparent 56%)",
    );
    layers.push(
      "radial-gradient(900px 560px at 42% 92%, rgba(34,197,94,0.08), transparent 62%)",
    );
    return (
      layers.join(", ") +
      ", linear-gradient(180deg, rgba(2,6,23,1), rgba(2,6,23,1))"
    );
  }, [runningTasksByCpu]);

  function resetSim() {
    setRunning(false);
    setNowMs(0);
    setTasks((prev) => prev.map((t) => ({ ...t, ranMs: 0, createdAtMs: 0 })));
    setCpuState((prev) =>
      prev.map(() => ({ taskId: null, idleStreakMs: 0, timeline: [] })),
    );
  }

  function addTask({ name, uid, seconds }) {
    touch("tasks");
    const remainingMs = clamp(Math.round(seconds * 1000), 250, 120_000);
    const task = {
      id: makeId(),
      name: name.trim() || `task:${uid}`,
      uid: Number(uid),
      runnable: true,
      remainingMs,
      createdAtMs: nowMs,
      ranMs: 0,
    };
    setTasks((prev) => [task, ...prev]);
  }

  function toggleRunnable(taskId) {
    touch("tasks");
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, runnable: !t.runnable } : t)),
    );
  }

  function removeTask(taskId) {
    touch("tasks");
    setRunning(false);
    setCpuState((prev) =>
      prev.map((c) => (c.taskId === taskId ? { ...c, taskId: null } : c)),
    );
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function pickNextTaskForUid(uid, excludedTaskIds = new Set()) {
    const arr = runnableByUid.get(String(uid)) || [];
    for (const t of arr) if (!excludedTaskIds.has(t.id)) return t;
    return null;
  }

  function pickAnyNextTask(excludedTaskIds = new Set()) {
    const candidates = runnableTasks
      .filter((t) => !excludedTaskIds.has(t.id))
      .slice()
      .sort((a, b) => b.remainingMs - a.remainingMs);
    return candidates[0] || null;
  }

  function buildAssignment() {
    const desired = Array.from({ length: cpuCount }, () => null);

    const alreadyUsed = new Set();
    for (let i = 0; i < cpuCount; i++) {
      const cur = cpuState[i].taskId;
      const t = cur ? tasks.find((x) => x.id === cur) : null;
      if (t && t.runnable && t.remainingMs > 0) {
        desired[i] = t.id;
        alreadyUsed.add(t.id);
      }
    }

    const fillCpu = (cpuIdx) => {
      if (desired[cpuIdx]) return;
      const t = pickAnyNextTask(alreadyUsed);
      if (t) {
        desired[cpuIdx] = t.id;
        alreadyUsed.add(t.id);
      }
    };

    if (entangledPair) {
      const [x, y] = entangledPair;
      const curX = desired[x] ? tasks.find((t) => t.id === desired[x]) : null;
      const curY = desired[y] ? tasks.find((t) => t.id === desired[y]) : null;
      const xIdle = !curX;
      const yIdle = !curY;
      const mismatch = curX && curY && curX.uid !== curY.uid;

      const runnableUids = Array.from(runnableByUid.keys()).map((k) =>
        Number(k),
      );

      const uidHas2 = (uid) => {
        const arr = runnableByUid.get(String(uid)) || [];
        let count = 0;
        for (const t of arr) {
          if (alreadyUsed.has(t.id)) continue;
          count++;
          if (count >= 2) return true;
        }
        return false;
      };

      if (mismatch || xIdle !== yIdle) {
        if (desired[x]) alreadyUsed.delete(desired[x]);
        if (desired[y]) alreadyUsed.delete(desired[y]);
        desired[x] = null;
        desired[y] = null;

        const preferredUids = runnableUids.filter(uidHas2);
        const pool = preferredUids.length ? preferredUids : runnableUids;

        const biasUid = curX?.uid ?? curY?.uid;
        if (biasUid != null && pool.includes(biasUid)) {
          pool.splice(pool.indexOf(biasUid), 1);
          pool.unshift(biasUid);
        }

        let chosenUid = null;
        for (const uid of pool) {
          const t1 = pickNextTaskForUid(uid, alreadyUsed);
          if (!t1) continue;
          alreadyUsed.add(t1.id);
          const t2 = pickNextTaskForUid(uid, alreadyUsed);
          alreadyUsed.delete(t1.id);
          if (t2 || !preferredUids.length) {
            chosenUid = uid;
            break;
          }
        }

        if (chosenUid != null) {
          const tX = pickNextTaskForUid(chosenUid, alreadyUsed);
          if (tX) {
            desired[x] = tX.id;
            alreadyUsed.add(tX.id);
          }
          const tY = pickNextTaskForUid(chosenUid, alreadyUsed);
          if (tY) {
            desired[y] = tY.id;
            alreadyUsed.add(tY.id);
          }
        }
      } else if (xIdle && yIdle && runnableTasks.length) {
        const uids = Array.from(runnableByUid.keys()).map((k) => Number(k));
        let chosenUid = null;
        for (const uid of uids) {
          const arr = runnableByUid.get(String(uid)) || [];
          const free = arr.filter((t) => !alreadyUsed.has(t.id));
          if (free.length >= 2) {
            chosenUid = uid;
            break;
          }
        }
        if (chosenUid == null) chosenUid = uids[0] ?? null;
        if (chosenUid != null) {
          const tX = pickNextTaskForUid(chosenUid, alreadyUsed);
          if (tX) {
            desired[x] = tX.id;
            alreadyUsed.add(tX.id);
          }
          const tY = pickNextTaskForUid(chosenUid, alreadyUsed);
          if (tY) {
            desired[y] = tY.id;
            alreadyUsed.add(tY.id);
          }
        }
      }
    }

    for (let i = 0; i < cpuCount; i++) fillCpu(i);

    if (entangledPair) {
      const [x, y] = entangledPair;
      const tx = desired[x] ? tasks.find((t) => t.id === desired[x]) : null;
      const ty = desired[y] ? tasks.find((t) => t.id === desired[y]) : null;
      if (tx && ty && tx.uid !== ty.uid) desired[y] = null;
    }

    return desired;
  }

  function stepScheduler() {
    touch("cpu");
    const desired = buildAssignment();

    setNowMs((prev) => prev + TICK_MS);

    setCpuState((prev) => {
      const next = prev.map((c, i) => {
        const taskId = desired[i] || null;
        const isIdle = !taskId;
        const slice = isIdle
          ? IDLE
          : (() => {
              const t = tasks.find((x) => x.id === taskId);
              return t
                ? { kind: "task", uid: t.uid, name: t.name, id: t.id }
                : IDLE;
            })();

        const idleStreakMs = isIdle
          ? c.idleStreakMs + (anyRunnable ? TICK_MS : 0)
          : 0;
        const timeline = [...c.timeline, slice];
        return { taskId, idleStreakMs, timeline };
      });
      return next;
    });

    setTasks((prev) => {
      const next = prev.map((t) => ({ ...t }));
      const ranIds = new Set(desired.filter(Boolean));

      for (const t of next) {
        if (!t.runnable || t.remainingMs <= 0) continue;
        if (ranIds.has(t.id)) {
          t.remainingMs = Math.max(0, t.remainingMs - TICK_MS);
          t.ranMs += TICK_MS;
        }
      }
      for (const t of next) if (t.remainingMs <= 0) t.runnable = false;
      return next;
    });
  }

  function loadDemo(kind) {
    touch("quick");
    setRunning(false);
    setNowMs(0);
    setCpuState(
      Array.from({ length: cpuCount }, () => ({
        taskId: null,
        idleStreakMs: 0,
        timeline: [],
      })),
    );

    if (kind === "twoUsers") {
      setTasks([
        {
          id: makeId(),
          name: "alice: build",
          uid: 1000,
          runnable: true,
          remainingMs: 10_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "bob: test",
          uid: 1001,
          runnable: true,
          remainingMs: 10_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "alice: docs",
          uid: 1000,
          runnable: true,
          remainingMs: 7_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "bob: lint",
          uid: 1001,
          runnable: true,
          remainingMs: 7_000,
          createdAtMs: 0,
          ranMs: 0,
        },
      ]);
    } else if (kind === "oneUser") {
      setTasks([
        {
          id: makeId(),
          name: "single uid",
          uid: 1000,
          runnable: true,
          remainingMs: 16_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "single uid (2)",
          uid: 1000,
          runnable: true,
          remainingMs: 14_000,
          createdAtMs: 0,
          ranMs: 0,
        },
      ]);
    } else if (kind === "manyUsers") {
      setTasks([
        {
          id: makeId(),
          name: "u1000",
          uid: 1000,
          runnable: true,
          remainingMs: 10_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "u1001",
          uid: 1001,
          runnable: true,
          remainingMs: 10_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "u1002",
          uid: 1002,
          runnable: true,
          remainingMs: 10_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "u1003",
          uid: 1003,
          runnable: true,
          remainingMs: 10_000,
          createdAtMs: 0,
          ranMs: 0,
        },
        {
          id: makeId(),
          name: "u1004",
          uid: 1004,
          runnable: true,
          remainingMs: 10_000,
          createdAtMs: 0,
          ranMs: 0,
        },
      ]);
    }
  }

  const cpuOptions = useMemo(
    () => Array.from({ length: cpuCount }, (_, i) => i),
    [cpuCount],
  );
  const [draftName, setDraftName] = useState("");
  const [draftUid, setDraftUid] = useState(1002);
  const [draftSeconds, setDraftSeconds] = useState(8);

  return (
    <div className="page" style={{ background: dynamicBg }}>
      <div className="wrap">
        <div className="topbar">
          <div>
            <div className="kicker">Nasir Sims</div>
            <h1 className="h1">Completely Fair Scheduler Demonstration</h1>
          </div>
        </div>

        <div className="topStrip">
          <div className="cfsBox">
            <div className="cfsTop">
              <div>
                <div className="cfsTitle">What is a CFS?</div>
                <div className="cfsSub">
                  Linux uses the{" "}
                  <span className="cfsStrong">
                    Completely Fair Scheduler (CFS)
                  </span>{" "}
                  to share CPU time between runnable tasks. It aims for fairness
                  by tracking each task's{" "}
                  <span className="cfsStrong">virtual runtime</span> and
                  choosing what should run next.
                </div>
              </div>

              <a
                className="pdfLink"
                href="/codehs/OS_CW1_25_26-3.pdf"
                target="_blank"
                rel="noreferrer noopener"
                title="Open the coursework PDF in a new tab"
              >
                Open assignment PDF ↗
              </a>
            </div>

            <div className="cfsGrid">
              <div>
                <div className="cfsLabel">For this homework assingment</div>
                <div className="cfsText">
                  I modifed scheduling so two “entangled” CPUs behave safely:
                  different user ids must not run at the same time across the
                  pair.
                </div>
              </div>
              <div>
                <div className="cfsLabel">What the diagram means</div>
                <div className="cfsText">
                  Each CPU circle is colored by the uid of the task currently
                  running there. The arc shows the entangled pair.
                </div>
              </div>
              <div>
                <div className="cfsLabel">Extra constraint</div>
                <div className="cfsText">
                  If runnable work exists, a CPU should not remain continuously
                  idle for 10 seconds.
                </div>
              </div>
            </div>
          </div>

          <div className="contextBox">
            <div className="contextTop">
              <div className="contextTitle">How to Use the Demonstration</div>
              <div className="contextPills">
                <Pill tone="neutral">click CPUs</Pill>
                <Pill tone="neutral">drag CPU count</Pill>
                <Pill tone="warn">set entangled pair</Pill>
                <Pill tone="good">add or block tasks</Pill>
              </div>
            </div>

            <div className="contextBody">
              <div>
                <div className="contextLabel">The diagram</div>
                <div className="contextText">
                  Each circle is a CPU. Its color comes from the uid of the task
                  it is running.
                </div>
              </div>
              <div>
                <div className="contextLabel">Entanglement</div>
                <div className="contextText">
                  The arc links two CPUs. When linked, they should the same uid
                  color. Different colors means the lock is broken.
                </div>
              </div>
              <div>
                <div className="contextLabel">Idle rule</div>
                <div className="contextText">
                  If runnable work exists, a CPU should not stay idle for 10
                  seconds.
                </div>
              </div>
            </div>

            <div className="contextTip">
              To get started: load Two users, press Play, then block one task
              and watch the link.
            </div>
          </div>

          <div className="quickRow2">
            <MiniButton
              kind="primary"
              onClick={() => loadDemo("twoUsers")}
              hot={!seen.quick}
            >
              Two users
            </MiniButton>
            <MiniButton
              kind="neutral"
              onClick={() => loadDemo("oneUser")}
              hot={!seen.quick}
            >
              One user
            </MiniButton>
            <MiniButton
              kind="neutral"
              onClick={() => loadDemo("manyUsers")}
              hot={!seen.quick}
            >
              Many users
            </MiniButton>
            <Pill tone={running ? "warn" : "neutral"}>
              time: <span style={{ fontWeight: 900 }}>{fmtMs(nowMs)}</span>
            </Pill>

            <span className="rowDivider" aria-hidden="true" />

            <MiniButton
              kind="primary"
              onClick={() => {
                touch("cpu");
                setRunning((v) => !v);
              }}
              hot={!seen.cpu}
            >
              {running ? "Pause" : "Play"}
            </MiniButton>
            <MiniButton
              onClick={() => stepScheduler()}
              disabled={running}
              title="Advance one tick"
              hot={!seen.cpu}
            >
              Step
            </MiniButton>
            <MiniButton
              onClick={() => {
                setSelectedCpu(null);
                resetSim();
              }}
              kind="neutral"
              disabled={running && nowMs === 0}
            >
              Reset
            </MiniButton>
          </div>
        </div>

        <div className="mainGrid">
          <div className="mainLeft">
            <Card
              title="CPU view"
              right={
                <div className="header-pills">
                  <Pill tone={entangledPair ? "warn" : "neutral"}>
                    {entangledPair
                      ? `CPU ${entangledPair[0]} ↔ CPU ${entangledPair[1]}`
                      : "no entangle"}
                  </Pill>
                  <Pill tone={entanglementStatus.ok ? "good" : "bad"}>
                    {entanglementStatus.ok ? "lock OK" : "lock broken"}
                  </Pill>
                  <Pill tone={idleViolations.length ? "bad" : "neutral"}>
                    idle:{" "}
                    {idleViolations.length
                      ? `CPU ${idleViolations.join(", ")}`
                      : "ok"}
                  </Pill>
                </div>
              }
              dim={!seen.cpu}
              onInteract={() => touch("cpu")}
              accent={entanglementStatus.ok ? "neutral" : "bad"}
            >
              <div className="explain-slot">
                {selectedCpu == null ? (
                  <div
                    className={hasPickedCpu ? "coach coach-compact" : "coach"}
                  >
                    <div>
                      <div className="coachTitle">Click a CPU</div>
                      <div className="coachSub"></div>
                    </div>

                    <div className="coachActions">
                      <MiniButton
                        kind="primary"
                        onClick={() => {
                          setHasPickedCpu(true);
                          setSelectedCpu(0);
                          touch("cpu");
                        }}
                        title="Show an example explanation"
                      >
                        Show me
                      </MiniButton>

                      <MiniButton
                        kind="neutral"
                        onClick={() => {
                          setHasPickedCpu(true);
                          const pick = entangledPair ? entangledPair[0] : 0;
                          setSelectedCpu(pick);
                          touch("cpu");
                        }}
                        title="Jump to the entangled CPU"
                      >
                        Show entangled
                      </MiniButton>
                    </div>
                  </div>
                ) : (
                  <CpuExplain
                    cpuIdx={selectedCpu}
                    entangledPair={entangledPair}
                    entanglementStatus={entanglementStatus}
                    anyRunnable={anyRunnable}
                    cpuState={cpuState}
                    runningTasksByCpu={runningTasksByCpu}
                    tasks={tasks}
                    onClose={() => setSelectedCpu(null)}
                  />
                )}
              </div>

              <CpuGraph
                cpuCount={cpuCount}
                runningByCpu={runningTasksByCpu}
                entangledPair={entangledPair}
                entanglementOk={entanglementStatus.ok}
                selectedCpu={selectedCpu}
                onSelectCpu={(idx) => {
                  setHasPickedCpu(true);
                  setSelectedCpu(idx);
                  touch("cpu");
                }}
              />

              <div className="cpu-list">
                {cpuState.map((c, i) => {
                  const rt = runningTasksByCpu[i];
                  const isEntangled =
                    entangledPair &&
                    (i === entangledPair[0] || i === entangledPair[1]);
                  const idleBad = anyRunnable && c.idleStreakMs >= 10_000;
                  const idleWarn =
                    anyRunnable && c.idleStreakMs > 0 && !idleBad;

                  const border = idleBad
                    ? "rgba(239,68,68,0.58)"
                    : isEntangled
                      ? "rgba(245,158,11,0.44)"
                      : "rgba(148,163,184,0.22)";

                  return (
                    <div
                      key={i}
                      className={`cpu-row ${selectedCpu === i ? "cpu-row-selected" : ""}`}
                      style={{ borderColor: border, cursor: "pointer" }}
                      onClick={() => {
                        setHasPickedCpu(true);
                        setSelectedCpu(i);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setHasPickedCpu(true);
                          setSelectedCpu(i);
                        }
                      }}
                      title="Click to explain this CPU"
                    >
                      <div className="cpu-row-head">
                        <div className="cpu-left">
                          <div className="cpu-name">CPU {i}</div>
                          {isEntangled ? (
                            <Pill tone="warn">linked</Pill>
                          ) : (
                            <Pill>normal</Pill>
                          )}
                          {rt.kind === "idle" ? (
                            <Pill
                              tone={
                                idleBad ? "bad" : idleWarn ? "warn" : "neutral"
                              }
                            >
                              idle {fmtMs(c.idleStreakMs)}
                            </Pill>
                          ) : (
                            <Pill tone="good">running</Pill>
                          )}
                        </div>

                        <div className="cpu-right">
                          {rt.kind === "idle" ? (
                            <span style={{ opacity: 0.75 }}>—</span>
                          ) : (
                            <>
                              <span
                                className="dot"
                                style={{ background: uidColor(rt.uid) }}
                              />
                              <span style={{ fontWeight: 850 }}>{rt.name}</span>
                              <span style={{ opacity: 0.75 }}>
                                (uid {rt.uid})
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <Timeline slices={c.timeline} />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="mainRight">
            <Card
              title="Controls"
              right={<Pill tone="neutral">tick {TICK_MS}ms</Pill>}
              dim={!seen.controls}
              onInteract={() => touch("controls")}
            >
              <div className="controls">
                <div>
                  <div className="label">CPU count</div>
                  <input
                    className={!seen.controls ? "pulse" : ""}
                    type="range"
                    min={1}
                    max={12}
                    value={cpuCount}
                    onChange={(e) => {
                      touch("controls");
                      setCpuCount(Number(e.target.value));
                    }}
                    style={{ width: "100%" }}
                  />
                  <div className="range-meta">
                    <span>1</span>
                    <span className="range-mid">{cpuCount}</span>
                    <span>12</span>
                  </div>
                </div>

                <div>
                  <div className="label">Entangled pair</div>
                  <div className="two">
                    <select
                      value={entangledA}
                      onChange={(e) => {
                        touch("controls");
                        setEntangledA(Number(e.target.value));
                      }}
                      className={!seen.controls ? "pulse" : ""}
                    >
                      {cpuOptions.map((c) => (
                        <option key={c} value={c}>
                          CPU {c}
                        </option>
                      ))}
                    </select>
                    <select
                      value={entangledB}
                      onChange={(e) => {
                        touch("controls");
                        setEntangledB(Number(e.target.value));
                      }}
                      className={!seen.controls ? "pulse" : ""}
                    >
                      {cpuOptions.map((c) => (
                        <option key={c} value={c}>
                          CPU {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hint">
                    Set both to the same CPU to turn entanglement off.
                  </div>
                </div>

                <div className="add-task">
                  <div className="label">Add task</div>
                  <div className="row4">
                    <input
                      value={draftName}
                      onChange={(e) => {
                        touch("tasks");
                        setDraftName(e.target.value);
                      }}
                      placeholder="name"
                    />
                    <input
                      value={draftUid}
                      onChange={(e) => {
                        touch("tasks");
                        setDraftUid(Number(e.target.value));
                      }}
                      type="number"
                      min={0}
                      step={1}
                      placeholder="uid"
                    />
                    <input
                      value={draftSeconds}
                      onChange={(e) => {
                        touch("tasks");
                        setDraftSeconds(Number(e.target.value));
                      }}
                      type="number"
                      min={0.25}
                      step={0.25}
                      placeholder="seconds"
                    />
                    <MiniButton
                      kind="primary"
                      onClick={() => {
                        addTask({
                          name: draftName,
                          uid: draftUid,
                          seconds: draftSeconds,
                        });
                        setDraftName("");
                      }}
                      hot={!seen.tasks}
                    >
                      Add
                    </MiniButton>
                  </div>
                </div>
              </div>
            </Card>

            <div style={{ marginTop: "1rem" }}>
              <Card
                title="Tasks"
                right={<Pill tone="neutral">block to force change</Pill>}
                dim={!seen.tasks}
                onInteract={() => touch("tasks")}
              >
                {tasks.length === 0 ? (
                  <EmptyHint>Hit “Two users” above, then press Play.</EmptyHint>
                ) : (
                  <div className="task-list">
                    {tasks
                      .slice()
                      .sort((a, b) =>
                        b.runnable === a.runnable
                          ? b.remainingMs - a.remainingMs
                          : Number(b.runnable) - Number(a.runnable),
                      )
                      .map((t) => {
                        const done = t.remainingMs <= 0;
                        const tone = done
                          ? "neutral"
                          : t.runnable
                            ? "good"
                            : "warn";
                        return (
                          <div key={t.id} className="task-row">
                            <div className="task-head">
                              <div className="task-left">
                                <span
                                  className="dot"
                                  style={{ background: uidColor(t.uid) }}
                                />
                                <div style={{ fontWeight: 900 }}>{t.name}</div>
                                <Pill tone={tone}>
                                  {done
                                    ? "done"
                                    : t.runnable
                                      ? "runnable"
                                      : "blocked"}
                                </Pill>
                                <span style={{ opacity: 0.78 }}>
                                  uid {t.uid}
                                </span>
                              </div>

                              <div className="task-actions">
                                <MiniButton
                                  onClick={() => toggleRunnable(t.id)}
                                  disabled={done}
                                  title="Toggle runnable/blocked"
                                >
                                  {t.runnable ? "Block" : "Unblock"}
                                </MiniButton>
                                <MiniButton
                                  kind="danger"
                                  onClick={() => removeTask(t.id)}
                                  title="Remove task"
                                >
                                  Remove
                                </MiniButton>
                              </div>
                            </div>

                            <div className="task-meter">
                              <div className="task-meta">
                                <span>
                                  left{" "}
                                  <span className="strong">
                                    {fmtMs(t.remainingMs)}
                                  </span>
                                </span>
                                <span>
                                  ran{" "}
                                  <span className="strong">
                                    {fmtMs(t.ranMs)}
                                  </span>
                                </span>
                              </div>
                              <ProgressBar
                                value={t.ranMs}
                                max={t.ranMs + t.remainingMs}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
