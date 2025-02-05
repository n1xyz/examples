import { createExecutableFunctions, NApp } from "@n1xyz/nts-sdk";

export class HelloWorld extends NApp {
  constructor() {
    super("helloworld");
  }

  hello() {
    console.log("hello world");
  }
}

export const { hello } = createExecutableFunctions(HelloWorld, "helloworld");
