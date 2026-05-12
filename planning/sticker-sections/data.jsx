// Sample data states for the three resident-home variants.

const DATA = {
  newUser: {
    name: 'Jordan',
    points: 10000, // signup bonus only
    pickupsCount: 0,
    bagsLeft: 0,
    nextPickup: null,
    pendingOrder: null,
    hasOrdered: false,
    activity: [],
    impact: { trees: 0, water: 0, lbs: 0, co2: 0 },
    campaign: null,
  },
  active: {
    name: 'Aguirre',
    points: 54320,
    pickupsCount: 4,
    bagsLeft: 6,
    nextPickup: { day: 'Monday', date: 'Apr 28', time: '6:00 PM' },
    pendingOrder: { sheets: 2, bags: 20, total: 16, status: 'queued', eta: 'Mon, Apr 28' },
    hasOrdered: true,
    activity: [
      { kind: 'pickup', label: 'Bag #A24-018', detail: '+4,200 pts', date: 'Apr 21' },
      { kind: 'redeem', label: '$10 Amazon redeemed', detail: '-100,000 pts', date: 'Apr 14' },
      { kind: 'pickup', label: 'Bag #A24-011', detail: '+3,850 pts', date: 'Apr 14' },
    ],
    impact: { trees: 1.2, water: 380, lbs: 47, co2: 84 },
    campaign: { mult: 2, materials: 'Aluminum & PET', endsIn: '3 days' },
  },
  power: {
    name: 'Sam',
    points: 92450,
    pickupsCount: 27,
    bagsLeft: 4,
    nextPickup: { day: 'Tomorrow', date: 'Apr 30', time: '6:00 PM' },
    pendingOrder: { sheets: 3, bags: 30, total: 22.5, status: 'out_for_delivery', eta: 'Today' },
    hasOrdered: true,
    activity: [
      { kind: 'pickup', label: 'Bag #A24-104', detail: '+5,120 pts', date: 'Apr 24' },
      { kind: 'pickup', label: 'Bag #A24-101', detail: '+4,840 pts', date: 'Apr 21' },
      { kind: 'redeem', label: '$10 Walmart redeemed', detail: '-100,000 pts', date: 'Apr 18' },
    ],
    impact: { trees: 7.4, water: 2840, lbs: 312, co2: 540 },
    campaign: { mult: 2, materials: 'Cardboard', endsIn: '6 days' },
  },
};

const fmtPts = (n) => n.toLocaleString('en-US');
const fmtDollars = (n) => '$' + n.toFixed(2);
const ptsToDollars = (p) => p / 10000;
const GIFT_TARGET = 100000;

Object.assign(window, { DATA, fmtPts, fmtDollars, ptsToDollars, GIFT_TARGET });
