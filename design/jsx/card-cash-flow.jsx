// Card — Cash flow — exported from Paper (Fine Print v3), node 22Y-0. Static mock: replace hard-coded text with props from the listing brief (see extension/docs/brief.md).
export default function CardCashFlow() {
  return (
    <div className="[font-synthesis:none] wrap-anywhere flex flex-col w-[400px] shrink-0 rounded-[18px] overflow-clip min-w-[0px] [box-shadow:#3C301C0F_0px_1px_2px,#3C301C0F_0px_10px_30px] bg-[#FBFAF6] border border-solid border-[#E2DDD2] antialiased">
      <div className="flex justify-between items-center py-3 px-[18px] bg-[#F6F3EC] border-b border-b-dashed border-b-[#E2DDD2]">
        <div className="text-[11px] font-['Geist_Mono',system-ui,sans-serif] leading-[14px] text-[#2F64D9]">
          show_weekly_cash_flow
        </div>
        <div className="text-xs font-[system-ui,sans-serif] leading-4 text-[#8C877D]">
          "What will it cost me?"
        </div>
      </div>
      <div className="flex flex-col p-[18px] gap-[14px]">
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-[2px]">
            <div className="text-[10px] font-['Geist_Mono',system-ui,sans-serif] leading-3 text-[#8C877D]">
              OUT OF POCKET · WEEKLY
            </div>
            <div className="text-display leading-[46px] font-['InstrumentSerif-Regular','Instrument_Serif',system-ui,sans-serif] text-[#1E1D1B]">
              −$94
            </div>
          </div>
          <div className="flex flex-col items-end gap-[2px]">
            <div className="text-[10px] font-['Geist_Mono',system-ui,sans-serif] leading-3 text-[#8C877D]">
              AFTER TAX @37%
            </div>
            <div className="text-xl leading-[28px] font-['InstrumentSerif-Regular','Instrument_Serif',system-ui,sans-serif] text-[#4A4741]">
              −$59
            </div>
          </div>
        </div>
        <div className="flex flex-col p-3 rounded-md gap-2 bg-bg border border-solid border-[#E6E1D6]">
          <div className="flex items-center gap-[10px]">
            <div className="w-[110px] text-xs shrink-0 font-[system-ui,sans-serif] leading-4 text-[#1E1D1B]">
              Rent
            </div>
            <div className="flex grow basis-[0%]">
              <div className="[width:100%] h-[10px] rounded-[3px] bg-[#2F64D9]" />
            </div>
            <div className="w-[46px] text-right text-[11px] shrink-0 font-['Geist_Mono',system-ui,sans-serif] leading-[14px] text-[#2F64D9]">
              +$850
            </div>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="w-[110px] flex flex-col shrink-0">
              <div className="text-xs font-[system-ui,sans-serif] leading-4 text-[#1E1D1B]">
                Loan interest
              </div>
              <div className="text-[10px] font-['Geist_Mono',system-ui,sans-serif] leading-3 text-[#8C877D]">
                $682K @ 6.0%
              </div>
            </div>
            <div className="flex grow basis-[0%]">
              <div className="w-[round(93%,1px)] h-[10px] rounded-[3px] bg-[#E3A008]" />
            </div>
            <div className="w-[46px] text-right text-[11px] shrink-0 font-['Geist_Mono',system-ui,sans-serif] leading-[14px] text-[#4A4741]">
              −$787
            </div>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="w-[110px] flex flex-col shrink-0">
              <div className="text-xs font-[system-ui,sans-serif] leading-4 text-[#1E1D1B]">
                Strata
              </div>
              <div className="text-[10px] font-['Geist_Mono',system-ui,sans-serif] leading-3 text-[#8C877D]">
                Zetland median
              </div>
            </div>
            <div className="flex grow basis-[0%]">
              <div className="w-[round(13%,1px)] h-[10px] rounded-[3px] bg-[#E3A008]" />
            </div>
            <div className="w-[46px] text-right text-[11px] shrink-0 font-['Geist_Mono',system-ui,sans-serif] leading-[14px] text-[#4A4741]">
              −$112
            </div>
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="w-[110px] text-xs shrink-0 font-[system-ui,sans-serif] leading-4 text-[#1E1D1B]">
              Rates + insurance
            </div>
            <div className="flex grow basis-[0%]">
              <div className="w-[round(5%,1px)] h-[10px] rounded-[3px] bg-[#E3A008]" />
            </div>
            <div className="w-[46px] text-right text-[11px] shrink-0 font-['Geist_Mono',system-ui,sans-serif] leading-[14px] text-[#4A4741]">
              −$45
            </div>
          </div>
        </div>
        <div className="text-xs leading-[18px] font-[system-ui,sans-serif] text-[#4A4741]">
          At the likely $852K with your 20% deposit. 86% of investors in this block run at a tax loss. <span className="text-[#8C877D] text-[10px] font-['Geist_Mono',system-ui,sans-serif]">valuation/negative-gearing · market/strata-levies</span>
        </div>
      </div>
    </div>
  );
}
