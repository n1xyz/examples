import { describe, expect, test } from "@jest/globals";
import { HelloWorld } from "../src";
import { injectMockStorage, createExecutableFunctions } from "@n1xyz/nts-sdk";

// Setup mock storage
injectMockStorage(HelloWorld);

describe("HelloWorld", () => {
  const { hello } = createExecutableFunctions(HelloWorld, "helloworld");

  test("should hello", () => {
    // Test hello
    hello();
    expect(1 + 1).toBe(2);
  });
});
