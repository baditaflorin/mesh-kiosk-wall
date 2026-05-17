import { useEffect, useMemo, useState } from "react";
import {
  createClockSync,
  useEventLog,
  useExpiringClaim,
  useFlashOnChange,
  useMeshSlot,
  useNamedPeer,
  useReactions,
  useWakeLock,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Post = {
  id: string;
  peerId: string;
  kind: "text" | "image";
  text?: string;
  dataUrl?: string;
  ts: number;
};

const REACTIONS: Array<{ kind: string; glyph: string }> = [
  { kind: "heart", glyph: "♥" },
  { kind: "fire", glyph: "🔥" },
  { kind: "eyes", glyph: "👀" },
];

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="kiosk-screen">
        <h1>kiosk wall</h1>
        <p>Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf, myName } = useNamedPeer(config, room);
  const claim = useExpiringClaim(room, "kiosk", 5 * 60_000);
  const posts = useEventLog<Post>(room, "posts");
  const reactions = useReactions(room, "kiosk-reactions");
  const clock = useMemo(() => createClockSync(room.provider), [room]);
  useEffect(() => () => clock.destroy(), [clock]);
  const slot = useMeshSlot(clock, 8_000);
  const [mode, setMode] = useState<"submit" | "display">("submit");
  const [text, setText] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const wake = useWakeLock();
  const flash = useFlashOnChange(posts.size);

  useEffect(() => {
    if (mode === "display") void wake.acquire();
    else void wake.release();
  }, [mode, wake]);

  const all = posts.events;
  const postIdx = all.length ? slot.slotId % all.length : 0;
  const current = all[postIdx];

  const claimWall = () => {
    claim.claim();
  };
  const releaseWall = () => {
    claim.release();
  };

  const submit = () => {
    const t = text.trim();
    const d = dataUrl.trim();
    if (!t && !d) return;
    posts.push({
      id: Math.random().toString(36).slice(2, 12),
      peerId: room.peerId,
      kind: d ? "image" : "text",
      text: t || undefined,
      dataUrl: d || undefined,
      ts: Date.now(),
    });
    setText("");
    setDataUrl("");
  };

  const claimedName = claim.claimedBy ? (nameOf(claim.claimedBy) ?? "peer") : null;
  const secs = Math.ceil(claim.msRemaining / 1000);

  return (
    <div className={`kiosk-screen kiosk-mode-${mode}`} data-flash={flash ? "1" : "0"}>
      <header className="kiosk-header">
        <h1>kiosk wall</h1>
        <input
          className="kiosk-name"
          placeholder="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
        />
        <div className="kiosk-modes" role="group" aria-label="mode">
          <button type="button" onClick={() => setMode("submit")} aria-pressed={mode === "submit"}>
            submit
          </button>
          <button
            type="button"
            onClick={() => setMode("display")}
            aria-pressed={mode === "display"}
          >
            display
          </button>
        </div>
      </header>

      <div className="kiosk-claim-row">
        {claim.isFree ? (
          <button type="button" className="kiosk-claim" onClick={claimWall}>
            CLAIM WALL
          </button>
        ) : (
          <span className="kiosk-claim-chip">
            {claimedName} holds the wall · {secs}s
          </span>
        )}
        {claim.isMine && (
          <button type="button" className="kiosk-release" onClick={releaseWall}>
            RELEASE WALL
          </button>
        )}
      </div>

      {mode === "display" && current && (
        <div className="kiosk-stage" aria-live="polite">
          {current.dataUrl && <img className="kiosk-stage-img" src={current.dataUrl} alt="" />}
          {current.text && <p className="kiosk-stage-text">{current.text}</p>}
          <p className="kiosk-stage-by">— {nameOf(current.peerId) ?? "peer"}</p>
        </div>
      )}

      {mode === "submit" && (
        <form
          className="kiosk-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            className="kiosk-text"
            placeholder="your post…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={280}
          />
          <input
            className="kiosk-image"
            placeholder="paste image data-URL (optional)"
            value={dataUrl}
            onChange={(e) => setDataUrl(e.target.value)}
          />
          <button type="submit" className="kiosk-post" aria-label="post it">
            post it
          </button>
        </form>
      )}

      <ul className="kiosk-feed">
        {all
          .slice()
          .reverse()
          .map((p) => (
            <li key={p.id} className="kiosk-feed-item">
              <div className="kiosk-feed-by">{nameOf(p.peerId) ?? "peer"}</div>
              {p.text && <div className="kiosk-feed-text">{p.text}</div>}
              {p.dataUrl && <img className="kiosk-feed-img" src={p.dataUrl} alt="" />}
              <div className="kiosk-reactions">
                {REACTIONS.map((r) => (
                  <button
                    key={r.kind}
                    type="button"
                    className="kiosk-react"
                    onClick={() => reactions.toggle(p.id, r.kind)}
                  >
                    {r.glyph} {reactions.countsFor(p.id)[r.kind] ?? 0}
                  </button>
                ))}
              </div>
            </li>
          ))}
      </ul>
      <p className="kiosk-foot">
        {myName} · {all.length} post{all.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
