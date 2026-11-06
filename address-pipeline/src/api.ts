/** One result of the Microburbs geocode endpoint. */
export interface GeocodeCandidate {
  id: string;
  display_name: string;
  property_type?: string;
}
