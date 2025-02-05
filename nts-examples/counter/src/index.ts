import { createExecutableFunctions, NApp } from "@n1xyz/nts-sdk";
import { hello } from "./hello";

export class Counter extends NApp {
  value: number = 0;

  getValue(): number {
    return this.value;
  }

  increment(amount: number = 1): void {
    hello();
    this.value += amount;
  }

  decrement(amount: number = 1): void {
    this.value -= amount;
  }
}

export const { increment, decrement } = createExecutableFunctions(Counter);
