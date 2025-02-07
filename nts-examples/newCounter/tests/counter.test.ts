import { describe, beforeEach, expect, test } from "@jest/globals";
import { Counter } from "../src";
import { injectMockStorage, createExecutableFunctions } from "@n1xyz/nts-sdk";

// Setup mock storage
injectMockStorage(Counter);

describe("Counter", () => {
  // beforeEach(() => {
  //   clearMockStorage();
  // });

  // Inject functions to test
  const { increment, decrement, getValue } = createExecutableFunctions(Counter);

  test("should correctly increment and decrement values", () => {
    // Test increment
    increment(5);
    expect(getValue()).toBe(5);

    // Test decrement
    decrement(2);
    expect(getValue()).toBe(3);
  });
});
