import test from "node:test";
import assert from "node:assert/strict";

import { DICTS, I18N_KEYS, makeT } from "../lib/i18n.ts";

test("every language has every key (no missing translations)", () => {
  for (const lang of ["en", "zu", "af"]) {
    for (const key of I18N_KEYS) {
      assert.ok(DICTS[lang][key] && DICTS[lang][key].length > 0, `missing ${lang}.${key}`);
    }
  }
});

test("translations differ across languages for nav labels", () => {
  assert.notEqual(DICTS.en["nav.disputes"], DICTS.zu["nav.disputes"]);
  assert.notEqual(DICTS.en["nav.disputes"], DICTS.af["nav.disputes"]);
});

test("makeT falls back to English then the key", () => {
  const tZu = makeT("zu");
  assert.equal(tZu("nav.disputes"), "Izikhalazo");
  // Unknown key falls back to the provided fallback, then the key itself.
  assert.equal(tZu("nope.key", "Fallback"), "Fallback");
  assert.equal(tZu("nope.key"), "nope.key");
});
