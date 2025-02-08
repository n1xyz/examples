import { describe, expect, test } from "@jest/globals";
import { MockNAppClient } from "@n1xyz/nts-compiler";

describe("System Actions", () => {
  test("should correctly create a mint", async () => {
    // Load a mock client
    const client = await MockNAppClient.loadClientFromPath(`src/index.ts`, {
      signer: "0x123",
      appAdmin: "0x123",
      appId: "0x123",
    });

    // Test create mint
    const mintAdmin = "0x123";
    await client.executeAction("mint", [100000, mintAdmin, {}]);

    const fields = await client.getFieldsByTag("_mint_admin");
    expect(fields[0].value).toBe(mintAdmin);
  });
});
