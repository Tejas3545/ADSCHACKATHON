import { subscribe } from "@/lib/broadcaster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  const cleanupRef: { cleanup?: () => void } = {};

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat so the browser knows the connection is alive
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      const unsub = subscribe((msg) => {
        try {
          controller.enqueue(encoder.encode(msg));
        } catch {
          // client disconnected
        }
      });

      // Keep-alive ping every 25 seconds
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(interval);
          unsub();
        }
      }, 25_000);

      // Cleanup when client disconnects
      const cleanup = () => {
        clearInterval(interval);
        unsub();
      };

      // Attach cleanup to stream cancellation — stored on a shared object
      cleanupRef.cleanup = cleanup;
    },
    cancel() {
      cleanupRef.cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
