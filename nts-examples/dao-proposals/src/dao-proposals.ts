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

enum VoteType {
    YAY = "yay",
    NAY = "nay",
    ABSTAIN = "abstain"
}

// Define the structure of a User Vote
interface Vote {
    proposalId: string;
    address: string;
    amount: number;
    vote: VoteType;
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
    vote(proposalId: string, startTime: number, endTime: number, vote: VoteType) {

        // validate parameters
        if (!proposalId || !startTime || !endTime || !vote) {
            throw new Error('Invalid proposal or vote');
        }

        if (startTime > Date.now()) {
            throw new Error('Proposal has not started yet');
        }

        if (endTime < Date.now()) {
            throw new Error('Proposal has ended');
        }

        if (vote !== VoteType.YAY && vote !== VoteType.NAY && vote !== VoteType.ABSTAIN) {
            throw new Error('Invalid vote type');
        }

        // Get user's token balance (assuming this is provided by the base layer)
        const userBalance = BigInt(this.tokenBalance(this.signer()));

        // Unique vote key for this user and proposal
        const voteKey = `${proposalId}____${this.signer()}`;

        const currentTime = Date.now();

        // Check if voting is within the proposal window
        if (currentTime < startTime || currentTime > endTime) {
            throw new Error('Voting is not currently open for this proposal');
        }

        // Store the new vote
        this.votes.set(voteKey, {
            proposalId: proposalId,
            address: this.signer(),
            amount: Number(userBalance),
            vote: vote
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