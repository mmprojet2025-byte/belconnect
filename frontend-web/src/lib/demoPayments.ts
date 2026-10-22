export type DemoPayment = { activityId: string; quantity: number; amountCents: number; completedAt: string };
const key = (userId: number) => `belconnect-demo-payments-${userId}`;

export function readDemoPayments(userId: number): DemoPayment[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    return Array.isArray(value) ? value.filter((item): item is DemoPayment =>
      typeof item?.activityId === 'string' && Number.isInteger(item?.quantity) &&
      Number.isInteger(item?.amountCents) && typeof item?.completedAt === 'string').slice(0, 30) : [];
  } catch { return []; }
}

export function saveDemoPayment(userId: number, payment: DemoPayment) {
  try { localStorage.setItem(key(userId), JSON.stringify([payment, ...readDemoPayments(userId)].slice(0, 30))); }
  catch { /* Private browsing or full storage: the simulation still works. */ }
}
