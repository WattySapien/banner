export const formatCurrency = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency,
  minimumFractionDigits: 2,
}).format(value);

export const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
}).format(new Date(value));
