const STARTERS = ['What will it cost me weekly?', 'What should I offer?', 'Is new supply a risk here?'];

export default function Starters({ busy, onPick }) {
  return (
    <div hidden={busy} className="flex flex-wrap gap-1.5 px-3 pb-2.5">
      {STARTERS.map((s) => (
        <button key={s} className="rounded-[14px]" onClick={() => onPick(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
