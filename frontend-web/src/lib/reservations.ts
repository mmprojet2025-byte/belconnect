export type Booking = {
  id: number;
  activityId: string;
  title: string;
  startsAt: string;
  location: string;
  quantity: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: "CONFIRMEE" | "ANNULEE";
  activityCancelled: boolean;
  version: number;
};
