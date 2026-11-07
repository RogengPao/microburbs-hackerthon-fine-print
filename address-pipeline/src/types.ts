/** An address split into its street line and place, as read from a page or typed. */
export interface ParsedAddress {
  /** Street line as given, e.g. "15 Sadka Lane". */
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}
