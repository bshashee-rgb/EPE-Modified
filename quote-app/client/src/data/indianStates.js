// Indian states & union territories, for the Source of Supply / Place of Supply dropdowns.
// Used to determine GST type: same state on both sides = intra-state (CGST+SGST),
// different states = inter-state (IGST). Plain reference data, no backend needed.
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// Same-state (vs different-state) comparison -> intra-state (CGST+SGST) vs inter-state (IGST).
// 'unknown' when either side is blank -- callers fall back to the plain flat "GST" label.
export function gstType(sourceState, placeOfSupplyState) {
  if (!sourceState || !placeOfSupplyState) return 'unknown';
  return sourceState === placeOfSupplyState ? 'intra' : 'inter';
}
