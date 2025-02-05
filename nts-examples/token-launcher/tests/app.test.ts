import { describe, beforeEach, expect, test } from "@jest/globals";
import { TokenLauncher } from "../src";
import {
  injectMockStorage,
  createExecutableFunctions,
  NTSInterface,
  getMockStorage,
} from "@n1xyz/nts-sdk";

// Setup mock storage
injectMockStorage(TokenLauncher);

describe("My first test", () => {
  // beforeEach(() => {
  //   clearMockStorage();
  // });

  // Inject functions to test
  const { createMint } = createExecutableFunctions(TokenLauncher);

  // Write tests here
  test("should create a mint", () => {
    createMint(1_000_000, "0x");

    const storage = getMockStorage();
    console.log(storage);
    // expect(true).toBe(true);
  });
});
