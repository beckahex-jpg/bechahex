export type ListingType = 'fixed_price' | 'auction';

export interface AuctionFormValues {
  startingPrice: string;
  minimumBidIncrement: string;
  shippingCost: string;
  startsAt: string;
  endsAt: string;
  winnerPaymentWindowHours: string;
}

function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function createDefaultAuctionValues(): AuctionFormValues {
  return {
    startingPrice: '',
    minimumBidIncrement: '1',
    shippingCost: '0',
    startsAt: toLocalInput(new Date()),
    endsAt: toLocalInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    winnerPaymentWindowHours: '24',
  };
}

export function auctionValuesAreValid(values: AuctionFormValues): boolean {
  const start = new Date(values.startsAt).getTime();
  const end = new Date(values.endsAt).getTime();
  const now = Date.now();
  const validMoney = (value: string, allowZero = false) => {
    const amount = Number(value);
    // Tolerate IEEE-754 noise: 19.99 * 100 !== 1999 exactly, so strict
    // equality would reject perfectly valid two-decimal amounts.
    return Number.isFinite(amount)
      && (allowZero ? amount >= 0 : amount > 0)
      && Math.abs(amount * 100 - Math.round(amount * 100)) <= 1e-6;
  };
  const paymentWindow = Number(values.winnerPaymentWindowHours);

  return validMoney(values.startingPrice)
    && validMoney(values.minimumBidIncrement)
    && validMoney(values.shippingCost, true)
    && Number.isInteger(paymentWindow)
    && paymentWindow >= 1
    && paymentWindow <= 168
    && Number.isFinite(start)
    && Number.isFinite(end)
    && end > now
    && start <= now + 365 * 24 * 60 * 60 * 1000
    && end - start >= 5 * 60 * 1000
    && end - start <= 30 * 24 * 60 * 60 * 1000;
}
