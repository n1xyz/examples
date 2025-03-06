import { NApp, NMap, createExecutableFunctions, _getBalance } from '@n1xyz/nts-compiler';

// Define the structure of a Proposal
interface Proposal {
    id: string;
    title: string;
    description: string;
    startTime: number;
    endTime: number;
    executed: boolean;
}

// Define the structure of a User Vote
interface Vote {
    proposalId: string;
    address: string;
    amount: number;
    votedYay: boolean;
}

export class DAOProposal extends NApp {
    proposals: NMap<Proposal>;
    votes: NMap<Vote>;

    constructor() {
        super();
        this.proposals = new NMap<Proposal>(this, "proposals");
        this.votes = new NMap<Vote>(this, "votes");
    }

    // Create a new proposal
    createProposal(
        proposalId: string, 
        title: string, 
        description: string, 
        startTime: number, 
        endTime: number
    ) {
        // Validate proposal parameters
        if (!proposalId || proposalId.trim() === '') {
            throw new Error('Proposal ID cannot be empty');
        }

        if (startTime >= endTime) {
            throw new Error('End time must be after start time');
        }

        // Create the proposal
        const newProposal: Proposal = {
            id: proposalId,
            title,
            description,
            startTime,
            endTime,
            executed: false
        };

        this.proposals.set(proposalId, newProposal);
    }

    // Vote on a proposal
    vote(proposal: Proposal, isYay: boolean) {

        // validate parameters
        if (!proposal || !isYay) {
            throw new Error('Invalid proposal or vote');
        }

        if (proposal.executed) {
            throw new Error('Proposal already executed');
        }

        if (proposal.startTime > Date.now()) {
            throw new Error('Proposal has not started yet');
        }

        if (proposal.endTime < Date.now()) {
            throw new Error('Proposal has ended');
        }

        // Get user's token balance (assuming this is provided by the base layer)
        const userBalance = BigInt(this.tokenBalance(this.signer()));

        // Unique vote key for this user and proposal
        const voteKey = `${proposal.id}____${this.signer()}`;

        const currentTime = Date.now();

        // Check if voting is within the proposal window
        if (currentTime < proposal.startTime || currentTime > proposal.endTime) {
            throw new Error('Voting is not currently open for this proposal');
        }

        // Store the new vote
        this.votes.set(voteKey, {
            proposalId: proposal.id,
            address: this.signer(),
            amount: Number(userBalance),
            votedYay: isYay
        });
    }

    // Token balance method (mock implementation, replace with actual token balance retrieval)
    tokenBalance(address: string): bigint {
        // This should be replaced with actual token balance retrieval logic
        // For now, we'll return a fixed balance for testing
        return BigInt(100);
    }
}

// Export executable functions
export const { 
    createProposal, 
    vote 
} = createExecutableFunctions(DAOProposal);