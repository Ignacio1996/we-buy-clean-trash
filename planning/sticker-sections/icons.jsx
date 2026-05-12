// Stroke icons for the WBCT resident redesigns.
// All icons accept size + color; default 20 / currentColor.

const Icon = ({ d, size = 20, color = 'currentColor', stroke = 1.75, fill = 'none', viewBox = '0 0 24 24', children, style }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    {d ? <path d={d} /> : children}
  </svg>
);

const IconHome      = (p) => <Icon {...p}><path d="M3 11l9-8 9 8" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></Icon>;
const IconScan      = (p) => <Icon {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3.5" /></Icon>;
const IconBag       = (p) => <Icon {...p}><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Icon>;
const IconGift      = (p) => <Icon {...p}><rect x="3" y="9" width="18" height="5" rx="1" /><path d="M5 14v7h14v-7M12 9v12" /><path d="M12 9c-2.5 0-5-1-5-3.5C7 4 8.5 3 10 3c1.5 0 2 1 2 2.5V9zM12 9c2.5 0 5-1 5-3.5C17 4 15.5 3 14 3c-1.5 0-2 1-2 2.5V9z" /></Icon>;
const IconUser      = (p) => <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></Icon>;
const IconArrow     = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
const IconCalc      = (p) => <Icon {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><rect x="8" y="6" width="8" height="3" rx="0.5" /><circle cx="9" cy="13" r="0.6" fill="currentColor" /><circle cx="12" cy="13" r="0.6" fill="currentColor" /><circle cx="15" cy="13" r="0.6" fill="currentColor" /><circle cx="9" cy="16.5" r="0.6" fill="currentColor" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" /><circle cx="15" cy="16.5" r="0.6" fill="currentColor" /></Icon>;
const IconLeaf      = (p) => <Icon {...p}><path d="M20 4c-2 8-7 13-15 16C4 12 11 4 20 4z" /><path d="M5 19c4-4 8-6 13-11" /></Icon>;
const IconDroplet   = (p) => <Icon {...p}><path d="M12 3l5 7a6 6 0 1 1-10 0l5-7z" /></Icon>;
const IconRecycle   = (p) => <Icon {...p}><path d="M7 17l-3-1 1-3" /><path d="M5 16c-1-3 0-6 3-7l3-2 2 3" /><path d="M19 13l1 3-3 1" /><path d="M20 16c-2 2-5 2-7 1l-3-1 1-3" /><path d="M14 5l-2-3-2 3" /></Icon>;
const IconCloud     = (p) => <Icon {...p}><path d="M6 18h12a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A4 4 0 0 0 6 18z" /></Icon>;
const IconBolt      = (p) => <Icon {...p}><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" /></Icon>;
const IconTruck     = (p) => <Icon {...p}><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></Icon>;
const IconBell      = (p) => <Icon {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></Icon>;
const IconCheck     = (p) => <Icon {...p}><path d="M5 12.5l4 4L19 6" /></Icon>;
const IconClose     = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const IconChevR     = (p) => <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>;
const IconChevD     = (p) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>;
const IconPlus      = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
const IconStar      = (p) => <Icon {...p}><path d="M12 3l2.6 5.5 6 .9-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.9L12 3z" /></Icon>;
const IconTrash     = (p) => <Icon {...p}><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></Icon>;
const IconClock     = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>;
const IconPin       = (p) => <Icon {...p}><path d="M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></Icon>;
const IconFire      = (p) => <Icon {...p}><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-9z" /></Icon>;
const IconCoin      = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9h4a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h4M12 7v10" /></Icon>;
const IconSparkle   = (p) => <Icon {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" /></Icon>;
const IconBottle    = (p) => <Icon {...p}><path d="M10 3h4v3l1 2v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8l1-2V3z" /></Icon>;
const IconCan       = (p) => <Icon {...p}><rect x="7" y="4" width="10" height="17" rx="2" /><path d="M7 8h10M9 4v17" /></Icon>;
const IconBox       = (p) => <Icon {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" /><path d="M3 7l9 4 9-4M12 11v10" /></Icon>;
const IconFlame     = IconFire;
const IconEarth     = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>;

Object.assign(window, {
  Icon, IconHome, IconScan, IconBag, IconGift, IconUser, IconArrow, IconCalc,
  IconLeaf, IconDroplet, IconRecycle, IconCloud, IconBolt, IconTruck, IconBell,
  IconCheck, IconClose, IconChevR, IconChevD, IconPlus, IconStar, IconTrash,
  IconClock, IconPin, IconFire, IconCoin, IconSparkle, IconBottle, IconCan,
  IconBox, IconFlame, IconEarth,
});
