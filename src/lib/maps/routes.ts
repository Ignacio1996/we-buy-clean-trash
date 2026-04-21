import 'server-only';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteWaypoint {
  id: string;
  location: LatLng;
}

export interface OptimizeRouteInput {
  origin: LatLng;
  destination: LatLng;
  waypoints: RouteWaypoint[];
}

export interface OptimizedRoute {
  orderedWaypointIds: string[];
  mocked: boolean;
}

function mockOptimize(input: OptimizeRouteInput): OptimizedRoute {
  // Nearest-neighbour from origin — decent stand-in so the stub isn't pure identity.
  const remaining = [...input.waypoints];
  const ordered: string[] = [];
  let cursor: LatLng = input.origin;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = distance(cursor, remaining[0].location);
    for (let i = 1; i < remaining.length; i++) {
      const d = distance(cursor, remaining[i].location);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next.id);
    cursor = next.location;
  }
  return { orderedWaypointIds: ordered, mocked: true };
}

function distance(a: LatLng, b: LatLng): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

interface RoutesApiResponse {
  routes?: Array<{
    optimizedIntermediateWaypointIndex?: number[];
  }>;
}

export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizedRoute> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || input.waypoints.length === 0) return mockOptimize(input);

  const body = {
    origin: { location: { latLng: input.origin } },
    destination: { location: { latLng: input.destination } },
    intermediates: input.waypoints.map((w) => ({ location: { latLng: w.location } })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    optimizeWaypointOrder: true,
  };

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) return mockOptimize(input);
    const json = (await res.json()) as RoutesApiResponse;
    const indices = json.routes?.[0]?.optimizedIntermediateWaypointIndex;
    if (!indices || indices.length !== input.waypoints.length) {
      // API returned identity order — keep input order.
      return {
        orderedWaypointIds: input.waypoints.map((w) => w.id),
        mocked: false,
      };
    }
    return {
      orderedWaypointIds: indices.map((i) => input.waypoints[i].id),
      mocked: false,
    };
  } catch {
    return mockOptimize(input);
  }
}
