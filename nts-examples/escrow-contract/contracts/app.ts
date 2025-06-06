import { 
  NApp, 
  NMap, 
  createExecutableFunctions,
  ntransfer,
  nmint
} from '@n1xyz/nts-compiler';

enum EscrowStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled'
}

interface EscrowData {
  buyer: string;
  seller: string;
  arbiter: string;
  mintId: string;
  amount: string;
  status: EscrowStatus;
  createdAt: number;
  description: string;
}

class EscrowContract extends NApp {
  escrows: NMap<EscrowData> = new NMap<EscrowData>(this, 'escrows');
  escrowCount: number;
  feePercentage: number; // Fee in basis points (100 = 1%)
  testTokenMintId: string; // Store the minted token ID

  init(): void {
    this.escrowCount = 0;
    this.feePercentage = 250; // 2.5% default fee
    this.testTokenMintId = ''; // Initialize empty
  }

  createEscrow(
    seller: string,
    arbiter: string,
    mintId: string,
    amount: string,
    description: string
  ): void {
    if (!seller || !arbiter || !mintId || !amount) {
      throw new Error('All parameters are required');
    }

    if (BigInt(amount) <= 0) {
      throw new Error('Amount must be positive');
    }

    const buyer = this.signer();
    if (buyer === seller) {
      throw new Error('Buyer and seller cannot be the same');
    }

    const escrowId = `escrow_${++this.escrowCount}`;

    // Transfer tokens from buyer to escrow contract
    ntransfer(buyer, this.appId(), mintId, BigInt(amount));

    const escrowData: EscrowData = {
      buyer,
      seller,
      arbiter,
      mintId,
      amount,
      status: EscrowStatus.PENDING,
      createdAt: this.time(),
      description
    };

    this.escrows.set(escrowId, escrowData, 'escrow_created', buyer);
    this.log('Escrow created:', { escrowId, buyer, seller, amount });
  }

  completeEscrow(escrowId: string): void {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new Error('Escrow is not pending');
    }

    const signer = this.signer();
    if (signer !== escrow.buyer) {
      throw new Error('Only buyer can complete escrow');
    }

    // Calculate fee
    const totalAmount = BigInt(escrow.amount);
    const feeAmount = (totalAmount * BigInt(this.feePercentage)) / BigInt(10000);
    const sellerAmount = totalAmount - feeAmount;

    // Transfer to seller (minus fee)
    ntransfer(this.appId(), escrow.seller, escrow.mintId, sellerAmount);

    // Keep fee in contract (could be withdrawn by admin later)

    escrow.status = EscrowStatus.COMPLETED;
    this.escrows.set(escrowId, escrow, 'escrow_completed', escrow.buyer);
    
    this.log('Escrow completed:', { 
      escrowId, 
      sellerAmount: sellerAmount.toString(),
      feeAmount: feeAmount.toString()
    });
  }

  disputeEscrow(escrowId: string): void {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new Error('Escrow is not pending');
    }

    const signer = this.signer();
    if (signer !== escrow.buyer && signer !== escrow.seller) {
      throw new Error('Only buyer or seller can dispute escrow');
    }

    escrow.status = EscrowStatus.DISPUTED;
    this.escrows.set(escrowId, escrow, 'escrow_disputed', signer);
    
    this.log('Escrow disputed:', { escrowId, disputedBy: signer });
  }

  resolveDispute(escrowId: string, refundToBuyer: boolean): void {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new Error('Escrow is not disputed');
    }

    const signer = this.signer();
    if (signer !== escrow.arbiter) {
      throw new Error('Only arbiter can resolve dispute');
    }

    const amount = BigInt(escrow.amount);
    const recipient = refundToBuyer ? escrow.buyer : escrow.seller;

    // Transfer full amount to resolved party (no fee on dispute resolution)
    ntransfer(this.appId(), recipient, escrow.mintId, amount);

    escrow.status = EscrowStatus.COMPLETED;
    this.escrows.set(escrowId, escrow, 'dispute_resolved', signer);
    
    this.log('Dispute resolved:', { 
      escrowId, 
      recipient, 
      refundToBuyer,
      amount: amount.toString()
    });
  }

  cancelEscrow(escrowId: string): void {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new Error('Escrow is not pending');
    }

    const signer = this.signer();
    if (signer !== escrow.seller) {
      throw new Error('Only seller can cancel escrow');
    }

    // Refund to buyer
    ntransfer(this.appId(), escrow.buyer, escrow.mintId, BigInt(escrow.amount));

    escrow.status = EscrowStatus.CANCELLED;
    this.escrows.set(escrowId, escrow, 'escrow_cancelled', signer);
    
    this.log('Escrow cancelled:', { escrowId });
  }

  updateFeePercentage(newFee: number): void {
    if (this.signer() !== this.appAdmin()) {
      throw new Error('Only admin can update fee');
    }

    if (newFee < 0 || newFee > 1000) { // Max 10%
      throw new Error('Fee must be between 0 and 1000 basis points');
    }

    this.feePercentage = newFee;
    this.log('Fee percentage updated:', newFee);
  }

  mintTestToken(totalSupply: string, metadata: string): void {
    if (this.testTokenMintId) {
      throw new Error('Test token already minted');
    }
    
    // Create a test token for escrow operations
    const mintId = nmint(
      BigInt(totalSupply),
      this.appId(), // Signer becomes admin
      metadata
    ) as any as string; // Cast to string as nmint returns string in runtime
    
    // Store the mint ID in contract state
    this.testTokenMintId = mintId;
    
    this.log('Test token minted:', { mintId, totalSupply, admin: this.signer() });
  }

  distributeTokens(recipient: string, mintId: string, amount: string): void {
    // Transfer tokens from current signer to recipient
    ntransfer(this.appId(), recipient, mintId, BigInt(amount));
    this.log('Tokens distributed:', { recipient, mintId, amount });
  }
}

export const { 
  init,
  createEscrow,
  completeEscrow,
  disputeEscrow,
  resolveDispute,
  cancelEscrow,
  updateFeePercentage,
  mintTestToken,
  distributeTokens
} = createExecutableFunctions(EscrowContract);
