/** Builds a standard Google Ad Manager VAST tag for a given ad unit + film. */
export function buildAdTagUrl(baseUrl: string, params: {
  adUnitPath: string;
  filmId: string;
  durationSeconds: number;
}): string {
  const url = new URL(baseUrl);
  url.searchParams.set("iu", params.adUnitPath);
  url.searchParams.set("description_url", `https://found.app/films/${params.filmId}`);
  url.searchParams.set("tfcd", "0");
  url.searchParams.set("npa", "0");
  url.searchParams.set("sz", "640x480");
  url.searchParams.set("gdfp_req", "1");
  url.searchParams.set("output", "vast");
  url.searchParams.set("unviewed_position_start", "1");
  url.searchParams.set("env", "vp");
  url.searchParams.set("impl", "s");
  url.searchParams.set("correlator", String(Date.now()));
  return url.toString();
}
