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
