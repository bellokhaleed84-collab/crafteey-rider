// Reasons a rider can pick. Shared by the app and the server so they match.
export const PROBLEM_REASONS = [
  "Customer is not answering",
  "Wrong or unclear address",
  "Vendor is not ready",
  "Item is damaged or missing",
  "The area feels unsafe",
  "Accident or vehicle trouble",
  "Something else",
] as const;

export const GIVE_UP_REASONS = [
  "Vehicle problem",
  "Too far from me",
  "Customer is not answering",
  "Wrong or unclear address",
  "Something else",
] as const;