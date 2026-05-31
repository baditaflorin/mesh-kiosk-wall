import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("claim wall + post → other peer sees post in feed", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "CLAIM WALL", exact: true }).click();
    await a.getByPlaceholder("your post…").fill("hello window");
    await a.getByRole("button", { name: "post it", exact: true }).click();

    await expect(b.locator(".kiosk-feed")).toContainText("hello window");
    await expect(b.locator(".kiosk-feed")).toContainText("alice");
  } finally {
    await cleanup();
  }
});

// The advertised claim has two halves: "Peers submit" (above) AND "wall
// cycles". The wall is a mesh-clock-synced rotating slot: each display picks
// `posts[slotId % posts.length]` from the SAME mesh-time slot, so two phones
// set to "display" in the same room must show the SAME post at the same time.
// This asserts that synchrony across peers — peer A submits two posts, both
// peers switch to display, and B's stage must mirror A's stage exactly.
test("wall cycles in sync → both display peers show the same post", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await a.waitForTimeout(500);

    // Two distinct posts so the cycling slot has something to choose between.
    await a.getByPlaceholder("your post…").fill("post-one");
    await a.getByRole("button", { name: "post it", exact: true }).click();
    await a.getByPlaceholder("your post…").fill("post-two");
    await a.getByRole("button", { name: "post it", exact: true }).click();

    // Both posts must have reached peer B's replicated log before we compare
    // the rotating stage — otherwise B could pick from a shorter array.
    await expect(b.locator(".kiosk-feed")).toContainText("post-one");
    await expect(b.locator(".kiosk-feed")).toContainText("post-two");

    // Put both phones into display ("wall") mode.
    await a.getByRole("button", { name: "display", exact: true }).click();
    await b.getByRole("button", { name: "display", exact: true }).click();
    await expect(a.locator(".kiosk-stage-text")).toBeVisible();
    await expect(b.locator(".kiosk-stage-text")).toBeVisible();

    // The mesh-synced slot must select the same post on both walls. Poll a few
    // times to ride across at least one slot boundary and confirm they stay in
    // lockstep rather than coincidentally agreeing once.
    for (let i = 0; i < 8; i++) {
      const onA = (await a.locator(".kiosk-stage-text").innerText()).trim();
      const onB = (await b.locator(".kiosk-stage-text").innerText()).trim();
      expect(["post-one", "post-two"]).toContain(onA);
      expect(onB).toBe(onA);
      await a.waitForTimeout(300);
    }
  } finally {
    await cleanup();
  }
});
