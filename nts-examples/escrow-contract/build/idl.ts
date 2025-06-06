// Auto-generated from idl.json
export type ContractIDL = {
  actions: {
    init: () => void,
    createEscrow: (seller: string, arbiter: string, mintId: string, amount: string, description: string) => void,
    completeEscrow: (escrowId: string) => void,
    disputeEscrow: (escrowId: string) => void,
    resolveDispute: (escrowId: string, refundToBuyer: boolean) => void,
    cancelEscrow: (escrowId: string) => void,
    updateFeePercentage: (newFee: number) => void,
    mintTestToken: (totalSupply: string, metadata: string) => void,
    distributeTokens: (recipient: string, mintId: string, amount: string) => void
  },
  state: {
    escrows: "NMap<EscrowData>",
    escrowCount: "number",
    feePercentage: "number",
    testTokenMintId: "string"
  }
};
export const IDL = {
  actions: {
    init: "() => void",
    createEscrow: "(seller: string, arbiter: string, mintId: string, amount: string, description: string) => void",
    completeEscrow: "(escrowId: string) => void",
    disputeEscrow: "(escrowId: string) => void",
    resolveDispute: "(escrowId: string, refundToBuyer: boolean) => void",
    cancelEscrow: "(escrowId: string) => void",
    updateFeePercentage: "(newFee: number) => void",
    mintTestToken: "(totalSupply: string, metadata: string) => void",
    distributeTokens: "(recipient: string, mintId: string, amount: string) => void"
  },
  state: {
    escrows: "NMap<EscrowData>",
    escrowCount: "number",
    feePercentage: "number",
    testTokenMintId: "string"
  }
};
