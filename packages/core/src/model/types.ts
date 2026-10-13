export type ItemType = 'activity' | 'food';
export type ISODate = string; // 'YYYY-MM-DD'

export interface Trip {
  id: string;
  ownerId: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  deletedAt: string | null;
  updatedAt: string;
}

export interface Block {
  id: string;
  tripId: string;
  name: string;
  position: string;
  updatedAt: string;
}

export interface DaySetting {
  tripId: string;
  date: ISODate;
  arrivalBlockId: string | null;
  departureBlockId: string | null;
  updatedAt: string;
}

export interface Item {
  id: string;
  tripId: string;
  name: string;
  type: ItemType;
  notes: string | null;
  link: string | null;
  updatedAt: string;
}

export interface Placement {
  id: string;
  tripId: string;
  date: ISODate;
  blockId: string;
  position: string;
  name: string;
  type: ItemType;
  notes: string | null;
  link: string | null;
  sourceItemId: string | null;
  updatedAt: string;
}

export interface TripState {
  trip: Trip;
  blocks: Block[];
  daySettings: DaySetting[];
  items: Item[];
  placements: Placement[];
}
