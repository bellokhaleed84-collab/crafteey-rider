export const CATEGORY_LABELS: Record<string, string> = {
  payment: "Payment or wallet",
  ride: "A delivery",
  app: "App not working",
  account: "My account",
  other: "Something else",
  order: "An order",
  technician: "A technician job",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
};

export const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  fixed: "bg-emerald-50 text-emerald-700",
};