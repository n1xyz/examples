import { createExecutableFunctions, TransferNApp } from "@n1xyz/nts-sdk";

export class TokenLauncher extends TransferNApp {
  createMint(totalSupply: number, admin: string) {
    this.mintAction(totalSupply, admin, {
      name: "My Token",
      symbol: "MTK",
      decimals: 6,
    });
  }

  // Test
  editMint() {}
}

export const { createMint } = createExecutableFunctions(TokenLauncher);
