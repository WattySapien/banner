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

export const formatAccountNumber = (accountNumber?:string, maskedNumber?:string) => {
  const finalFour=(accountNumber??maskedNumber??"").replace(/\D/g,"").slice(-4).padStart(4,"x");
  return `xxxxxxxx${finalFour}`;
};
