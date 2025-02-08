import { describe, expect, test } from "@jest/globals";
import { MockNAppClient } from "@n1xyz/nts-compiler";

describe("Counter", () => {
  test("should correctly increment and decrement values", async () => {
    // Load a mock client
    const client = await MockNAppClient.loadClientFromPath(`src/index.ts`, {
      signer: "0x123",
      appAdmin: "0x123",
      appId: "0x123",
    });

    // Test increment
    await client.executeAction("increment", [5]);
    const res = await client.readField("value");
    expect(res).toBe("5");

    // Test decrement
    await client.executeAction("decrement", [2]);
    const res2 = await client.readField("value");
    expect(res2).toBe("3");
  });
});
