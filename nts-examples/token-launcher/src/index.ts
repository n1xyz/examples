import { createExecutableFunctions, TransferNApp } from "@n1xyz/nts-sdk";

export class TokenLauncher extends TransferNApp {
  mint_count: number = 0;

  createMint(totalSupply: number, admin: string) {
    this.mint_count++;
    this.mintAction(totalSupply, admin, {
      name: "My Token",
      symbol: "MTK",
      decimals: 6,
    });
  }
}

export const { createMint } = createExecutableFunctions(TokenLauncher);
