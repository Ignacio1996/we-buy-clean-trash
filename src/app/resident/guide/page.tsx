import { EcoH1, EcoMasthead } from '@/components/resident/eco/Eco';
import {
  IconBox,
  IconDroplet,
  IconLeaf,
  IconRecycle,
} from '@/components/icons/EcoIcons';
import type { ComponentType, SVGProps } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'stroke'> {
  size?: number;
  color?: string;
  stroke?: number;
}
type Icon = ComponentType<IconProps>;

interface Item {
  Ic: Icon;
  title: string;
  body: string;
}

const GOOD: Item[] = [
  {
    Ic: IconDroplet,
    title: 'Empty, rinsed water bottle',
    body: 'Cap removed, no liquid inside.',
  },
  {
    Ic: IconBox,
    title: 'Flattened cardboard box',
    body: 'No tape, dry, no food stains.',
  },
  {
    Ic: IconRecycle,
    title: 'Rinsed aluminum can',
    body: 'Drained, no food residue.',
  },
];

const BAD: Item[] = [
  {
    Ic: IconDroplet,
    title: 'Half-full soda bottle',
    body: 'Must be empty & rinsed first.',
  },
  {
    Ic: IconBox,
    title: 'Greasy pizza box',
    body: 'Food-soiled cardboard is contamination.',
  },
  {
    Ic: IconRecycle,
    title: 'Plastic with food residue',
    body: 'Rinse before putting it in the bag.',
  },
];

export default function GuidePage() {
  return (
    <main className="relative px-5 pt-12 sm:px-8 sm:pt-14">
      <EcoMasthead backHref="/resident" />

      <section className="mb-6">
        <div className="eco-eyebrow mb-2">Recycling guide</div>
        <EcoH1>Do it right, earn more.</EcoH1>
      </section>

      <section
        className="rounded-[14px] border p-4"
        style={{ background: '#E8EFE6', borderColor: 'rgba(45,90,61,0.3)' }}
      >
        <div
          className="eco-eyebrow"
          style={{ color: '#2D5A3D', fontWeight: 600 }}
        >
          Good
        </div>
        <ul className="mt-3 space-y-3">
          {GOOD.map(({ Ic, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: '#FBF7EE', color: '#2D5A3D' }}
              >
                <Ic size={16} stroke={1.75} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--eco-serif)',
                    fontSize: 15,
                    color: '#1F2A22',
                    lineHeight: 1.3,
                  }}
                >
                  {title}
                </div>
                <div className="mt-0.5" style={{ fontSize: 12, color: '#5A6358' }}>
                  {body}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="mt-3 rounded-[14px] border p-4"
        style={{ background: '#F0DCC8', borderColor: 'rgba(154,75,38,0.3)' }}
      >
        <div
          className="eco-eyebrow"
          style={{ color: '#9A4B26', fontWeight: 600 }}
        >
          Not accepted
        </div>
        <ul className="mt-3 space-y-3">
          {BAD.map(({ Ic, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: '#FBF7EE', color: '#9A4B26' }}
              >
                <Ic size={16} stroke={1.75} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--eco-serif)',
                    fontSize: 15,
                    color: '#1F2A22',
                    lineHeight: 1.3,
                  }}
                >
                  {title}
                </div>
                <div className="mt-0.5" style={{ fontSize: 12, color: '#5A6358' }}>
                  {body}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-3 rounded-[14px] border border-[#D9D2C2] bg-[#FBF7EE] p-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
            style={{ background: '#E8EFE6', color: '#2D5A3D' }}
          >
            <IconLeaf size={16} stroke={1.75} />
          </div>
          <div
            className="eco-eyebrow"
            style={{ color: '#2D5A3D', fontWeight: 600 }}
          >
            Tip · Preparing an oil can
          </div>
        </div>
        <ol
          className="mt-3 list-inside list-decimal space-y-1.5"
          style={{ fontSize: 14, color: '#1F2A22', lineHeight: 1.5 }}
        >
          <li>Empty all oil completely.</li>
          <li>Rinse with warm soapy water.</li>
          <li>Let dry before putting in a bag.</li>
        </ol>
      </section>

      <p
        className="mt-6 text-center italic"
        style={{ fontFamily: 'var(--eco-serif)', fontSize: 12, color: '#8A8A7A' }}
      >
        More guides coming soon.
      </p>
    </main>
  );
}
