import type { ActivityDetails } from "./activityDetails";
export type Activity = {
  id: string;
  demonstration: boolean;
  details: ActivityDetails;
  title: string;
  category: string;
  city: string;
  location: string;
  host: string;
  price: number;
  image: string;
  date: string;
  startsAt: string;
  closesAt?: string | null;
  weekend: boolean;
  description: string;
  badge?: string;
};

export const categories = [
  { id: "art", label: "Art & Céramique", icon: "palette" },
  { id: "gastronomie", label: "Gastronomie", icon: "cup" },
  { id: "nature", label: "Plein air & Nature", icon: "leaf" },
  { id: "culture", label: "Culture & Spectacles", icon: "ticket" },
  { id: "savoir-faire", label: "Savoir-faire", icon: "tools" },
  { id: "bien-etre", label: "Bien-être", icon: "sun" },
];
