// Given a set of candidate box arts for a game, pick the one whose aspect ratio
// best matches a shelf box (3:4). The catalog can't tell us image dimensions, so
// we load each candidate and measure it in the browser.

const BOX_RATIO = 3 / 4;

function measure(url) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ratio) => {
      if (!settled) {
        settled = true;
        resolve({ url, ratio });
      }
    };
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => finish(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
    img.onerror = () => finish(null);
    img.src = url;
    setTimeout(() => finish(null), 4000); // never hang the add flow on a slow image
  });
}

export async function pickBestCover(urls, target = BOX_RATIO) {
  const candidates = [...new Set((urls ?? []).filter(Boolean))];
  if (candidates.length <= 1) return candidates[0] ?? null;

  const measured = (await Promise.all(candidates.map(measure))).filter((m) => m.ratio);
  if (!measured.length) return candidates[0];

  measured.sort((a, b) => Math.abs(a.ratio - target) - Math.abs(b.ratio - target));
  return measured[0].url;
}
