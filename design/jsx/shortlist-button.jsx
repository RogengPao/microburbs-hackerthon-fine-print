// Shortlist button — exported from Paper (Fine Print v3), node 2FX-0. Static mock: replace hard-coded text with props from the listing brief (see extension/docs/brief.md).
export default function ShortlistButton() {
  return (
    <div className="[font-synthesis:none] wrap-anywhere text-xs leading-4 w-[420px] h-[46px] flex items-center justify-center rounded-[14px] gap-[10px] [box-shadow:#FFFFFF2E_0px_1px_0px_inset,#2F64D947_0px_10px_24px] bg-[#2F64D9] antialiased">
      <svg width="14" height="14" viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
        <path d="M3 1.5h7v10l-3.5-2.5L3 11.5z" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="text-base font-['Geist',system-ui,sans-serif] font-[600] leading-[18px] text-bg">
        Shortlist this property
      </div>
      <div className="flex items-center justify-center h-[20px] px-[6px] rounded-[5px] bg-[#FFFFFF2E]">
        <div className="text-[10px] font-['Geist_Mono',system-ui,sans-serif] leading-3 text-bg">
          S
        </div>
      </div>
    </div>
  );
}
