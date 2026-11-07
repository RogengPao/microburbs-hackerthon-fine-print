/**
 * Address-only snapshots of real listings (captured 2026-11). Each holds only the
 * URL, the Residence node's address, the <h1> text and og:title. No listing text,
 * prices, agents or photos. See real-listings.md for the format notes.
 */
export interface RealListing {
  site: "realestate" | "domain";
  kind: "house" | "unit" | "range" | "lot" | "hidden" | "saint-mount" | "townhouse";
  url: string;
  /** Residence address as in JSON-LD; null when the page has no Residence node. */
  residence: { street: string; suburb: string; region: string; postcode: string } | null;
  h1: string;
  ogTitle: string;
  /** Set when extraction currently disagrees with the h1; the case is then skipped. */
  todo?: string;
}

const a = (street: string, suburb: string, region: string, postcode: string) => ({
  street,
  suburb,
  region,
  postcode,
});

const R = (
  kind: RealListing["kind"],
  path: string,
  residence: RealListing["residence"],
  h1: string,
  ogTitle = h1,
): RealListing => ({
  site: "realestate",
  kind,
  url: `https://www.realestate.com.au/${path}`,
  residence,
  h1,
  ogTitle,
});

const D = (
  kind: RealListing["kind"],
  path: string,
  residence: RealListing["residence"],
  h1: string,
): RealListing => ({
  site: "domain",
  kind,
  url: `https://www.domain.com.au/${path}`,
  residence,
  h1,
  ogTitle: `${h1} | Domain`,
});

export const realListings: RealListing[] = [
  R("unit", "property-apartment-vic-st+kilda-151995316", a("20/82 Grey Street", "St Kilda", "VIC", "3182"), "20/82 Grey Street, St Kilda, Vic 3182"),
  R("unit", "property-apartment-vic-st+kilda-152396932", a("5/17 Robe Street", "St Kilda", "VIC", "3182"), "5/17 Robe Street, St Kilda, Vic 3182"),
  R("saint-mount", "property-house-vic-st+kilda-151044188", a("28 Marine Parade", "St Kilda", "VIC", "3182"), "28 Marine Parade, St Kilda, Vic 3182"),
  R("hidden", "property-apartment-vic-st+kilda-147235452", null, "Address available on request, St Kilda, Vic 3182", "Address available on request, St Kilda"),
  R("unit", "property-house-wa-mount+lawley-152702912", a("2/66 Third Avenue", "Mount Lawley", "WA", "6050"), "2/66 Third Avenue, Mount Lawley, WA 6050"),
  R("unit", "property-house-wa-mount+lawley-152839216", a("4/64A Third Avenue", "Mount Lawley", "WA", "6050"), "4/64A Third Avenue, Mount Lawley, WA 6050"),
  R("unit", "property-apartment-wa-mount+lawley-152568152", a("7/598 William Street", "Mount Lawley", "WA", "6050"), "7/598 William Street, Mount Lawley, WA 6050"),
  R("unit", "property-apartment-wa-mount+lawley-152825284", a("29/169 Railway Parade", "Mount Lawley", "WA", "6050"), "29/169 Railway Parade, Mount Lawley, WA 6050"),
  R("saint-mount", "property-house-vic-mount+waverley-152857084", a("22 William Street", "Mount Waverley", "VIC", "3149"), "22 William Street, Mount Waverley, Vic 3149"),
  R("unit", "property-townhouse-vic-mount+waverley-152698756", a("2/18 Larch Crescent", "Mount Waverley", "VIC", "3149"), "2/18 Larch Crescent, Mount Waverley, Vic 3149"),
  R("house", "property-house-vic-mount+waverley-151150736", a("22 Amber Grove", "Mount Waverley", "VIC", "3149"), "22 Amber Grove, Mount Waverley, Vic 3149"),
  R("range", "property-apartment-nsw-st+ives-152856224", a("322/17-19 Memorial Avenue", "St Ives", "NSW", "2075"), "322/17-19 Memorial Avenue, St Ives, NSW 2075"),
  R("house", "property-house-nsw-st+ives-151982944", a("76a Douglas Street", "St Ives", "NSW", "2075"), "76a Douglas Street, St Ives, NSW 2075"),
  R("townhouse", "property-townhouse-wa-shenton+park-152402928", a("17 Bowman Street", "Shenton Park", "WA", "6008"), "17 Bowman Street, Shenton Park, WA 6008"),
  R("lot", "property-residential+land-vic-tarneit-204693284", a("Lot, 5511 Nautical Cct", "Tarneit", "VIC", "3029"), "Lot, 5511 Nautical Cct, Tarneit, Vic 3029"),
  R("lot", "property-residential+land-vic-tarneit-204659160", a("Lot, Lot 5532 Verday Bvd", "Tarneit", "VIC", "3029"), "Lot, Lot 5532 Verday Bvd, Tarneit, Vic 3029"),
  D("unit", "1005-95-st-kilda-road-st-kilda-vic-3182-2019195498", a("1005/95 St Kilda Road", "St Kilda", "VIC", "3182"), "1005/95 St Kilda Road, St Kilda VIC 3182"),
  D("saint-mount", "96-wellington-street-st-kilda-vic-3182-2021305409", a("96 Wellington Street", "St Kilda", "VIC", "3182"), "96 Wellington Street, St Kilda VIC 3182"),
  D("unit", "6-31-robe-street-st-kilda-vic-3182-2021196550", a("6/31 Robe Street", "St Kilda", "VIC", "3182"), "6/31 Robe Street, St Kilda VIC 3182"),
  D("range", "g01-54-56-chapel-street-st-kilda-vic-3182-2021299594", a("G01/54-56 Chapel Street", "St Kilda", "VIC", "3182"), "G01/54-56 Chapel Street, St Kilda VIC 3182"),
  D("unit", "b20-1-eildon-road-st-kilda-vic-3182-2021119082", a("B20/1 Eildon Road", "St Kilda", "VIC", "3182"), "B20/1 Eildon Road, St Kilda VIC 3182"),
  D("saint-mount", "44-ingleton-lane-mount-lawley-wa-6050-2021303968", a("44 Ingleton Lane", "Mount Lawley", "WA", "6050"), "44 Ingleton Lane, Mount Lawley WA 6050"),
  D("house", "786-beaufort-street-mount-lawley-wa-6050-2021303533", a("786 Beaufort Street", "Mount Lawley", "WA", "6050"), "786 Beaufort Street, Mount Lawley WA 6050"),
  D("unit", "18-1-rookwood-street-mount-lawley-wa-6050-2021301373", a("18/1 Rookwood Street", "Mount Lawley", "WA", "6050"), "18/1 Rookwood Street, Mount Lawley WA 6050"),
  D("unit", "2-536-waverley-road-mount-waverley-vic-3149-2021279930", a("2/536 Waverley Road", "Mount Waverley", "VIC", "3149"), "2/536 Waverley Road, Mount Waverley VIC 3149"),
  D("house", "24-kingsley-grove-mount-waverley-vic-3149-2021256587", a("24 Kingsley Grove", "Mount Waverley", "VIC", "3149"), "24 Kingsley Grove, Mount Waverley VIC 3149"),
  D("house", "3-randall-court-mount-waverley-vic-3149-2021254186", a("3 Randall Court", "Mount Waverley", "VIC", "3149"), "3 Randall Court, Mount Waverley VIC 3149"),
  D("house", "68-lynbara-avenue-st-ives-nsw-2075-2021305539", a("68 Lynbara Avenue", "St Ives", "NSW", "2075"), "68 Lynbara Avenue, St Ives NSW 2075"),
  D("range", "7-131-135-mona-vale-road-st-ives-nsw-2075-2021305530", a("7/131-135 Mona Vale Road", "St Ives", "NSW", "2075"), "7/131-135 Mona Vale Road, St Ives NSW 2075"),
  D("range", "322-17-19-memorial-avenue-st-ives-nsw-2075-2021305218", a("322/17-19 Memorial Avenue", "St Ives", "NSW", "2075"), "322/17-19 Memorial Avenue, St Ives NSW 2075"),
  D("range", "d538-17-19-memorial-avenue-st-ives-nsw-2075-2021273111", a("D538/17-19 Memorial Avenue", "St Ives", "NSW", "2075"), "D538/17-19 Memorial Avenue, St Ives NSW 2075"),
  D("lot", "lot-430-dawbin-road-tarneit-vic-3029-2018999132", a("Lot 430 Dawbin Road", "Tarneit", "VIC", "3029"), "Lot 430 Dawbin Road, Tarneit VIC 3029"),
  D("lot", "lot-916-34-meerkat-road-tarneit-vic-3029-2020546278", a("Lot 916 34 Meerkat Road", "Tarneit", "VIC", "3029"), "Lot 916 34 Meerkat Road, Tarneit VIC 3029"),
  D("lot", "lot-402-16-lomatia-road-tarneit-vic-3029-2020621589", a("Lot 402 16 Lomatia Road", "Tarneit", "VIC", "3029"), "Lot 402 16 Lomatia Road, Tarneit VIC 3029"),
];
