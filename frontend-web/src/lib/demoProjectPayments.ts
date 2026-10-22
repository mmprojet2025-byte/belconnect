export type DemoProjectPayment = { projectId: number; projectTitle: string; spaceName: string; imageUrl: string | null; startsOn: string | null; endsOn: string | null; priceCents: number; completedAt: string };
const key = (userId: number) => `belconnect-demo-project-payments-${userId}`;

export function readDemoProjectPayments(userId: number): DemoProjectPayment[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    return Array.isArray(value) ? value.filter((item): item is DemoProjectPayment =>
      Number.isInteger(item?.projectId) && item.projectId > 0 && Number.isInteger(item?.priceCents) &&
      item.priceCents > 0 && typeof item?.projectTitle === 'string' && typeof item?.spaceName === 'string' &&
      typeof item?.completedAt === 'string').slice(0, 30) : [];
  } catch { return []; }
}

export function saveDemoProjectPayment(userId: number, payment: DemoProjectPayment) {
  try { localStorage.setItem(key(userId), JSON.stringify([payment, ...readDemoProjectPayments(userId).filter(item => item.projectId !== payment.projectId)].slice(0, 30))); }
  catch { /* Storage can be unavailable in private browsing. */ }
}
