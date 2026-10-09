// Android slows down web requests from the app's browser engine after about
// 5 minutes in the background. The location and online pings are the ones
// that must keep working with the phone locked, so inside the Android app
// only those two are sent through the phone's native network layer.

const PING_PATHS = [/^\/api\/couriers\/online$/, /^\/api\/courier-requests\/[^/]+\/location$/];

export async function installBackgroundFetch(): Promise<void> {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.__crafteeyNativeFetch) return;

  const { Capacitor, CapacitorHttp } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  w.__crafteeyNativeFetch = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      if (typeof input === "string") {
        const url = new URL(input, window.location.href);
        const body = init?.body;
        const isPing =
          url.origin === window.location.origin && PING_PATHS.some((re) => re.test(url.pathname));
        const simpleBody = body === undefined || body === null || typeof body === "string";

        if (isPing && simpleBody) {
          const headers: Record<string, string> = {};
          new Headers(init?.headers).forEach((value, key) => {
            headers[key] = value;
          });

          let data: unknown = undefined;
          if (typeof body === "string") {
            try {
              data = JSON.parse(body);
            } catch {
              data = body;
            }
          }

          const res = await CapacitorHttp.request({
            url: url.href,
            method: (init?.method ?? "GET").toUpperCase(),
            headers,
            data,
            responseType: "json",
          });

          const noBody = res.status === 204 || res.status === 205 || res.status === 304;
          const text = noBody
            ? null
            : typeof res.data === "string"
              ? res.data
              : JSON.stringify(res.data ?? null);

          return new Response(text, {
            status: res.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    } catch {
      // fall through to the normal fetch below
    }
    return original(input, init);
  };
}