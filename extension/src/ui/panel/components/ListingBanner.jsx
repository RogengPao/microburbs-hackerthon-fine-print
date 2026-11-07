export default function ListingBanner({ ready, listing }) {
  const text = !ready
    ? 'No listing detected — open a realestate.com.au property page.'
    : listing
      ? `Reading: ${listing.page?.heading ?? listing.title}${listing.page ? '' : ' (page not readable — URL only)'}`
      : 'No listing detected — you can still ask about any City of Sydney address.';
  return <div className={`border-b border-line px-3 py-2 text-xs ${listing ? '' : 'text-muted'}`}>{text}</div>;
}
