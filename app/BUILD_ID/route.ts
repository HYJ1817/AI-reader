export const dynamic = "force-static";

export function GET() {
  return new Response(process.env.NEXT_PUBLIC_READER_BUILD_ID ?? "development", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
