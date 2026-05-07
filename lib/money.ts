export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

export const calcMargin = (selling: number, bought: number) => {
  const amount = selling - bought;
  const pct = bought === 0 ? 0 : (amount / bought) * 100;
  return { amount, pct };
};
