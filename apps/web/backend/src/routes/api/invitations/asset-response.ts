import parseRange from 'range-parser';

const PARTIAL_CONTENT = 206;
const RANGE_NOT_SATISFIABLE = 416;

export function assetResponse(input: { asset: Blob; range: string | null }) {
  const headers = new Headers({
    'content-type': input.asset.type || 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': 'private, no-store',
    'content-security-policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
  });
  if (!input.range) {
    headers.set('content-length', String(input.asset.size));
    return new Response(input.asset, { headers });
  }
  const size = input.asset.size;
  const ranges = parseRange(size, input.range, { combine: true });
  if (typeof ranges === 'number' || ranges.type !== 'bytes' || ranges.length !== 1) {
    headers.set('content-range', `bytes */${size}`);
    return new Response(null, { status: RANGE_NOT_SATISFIABLE, headers });
  }
  const { start, end } = ranges[0]!;
  headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  return new Response(input.asset.slice(start, end + 1), { status: PARTIAL_CONTENT, headers });
}
