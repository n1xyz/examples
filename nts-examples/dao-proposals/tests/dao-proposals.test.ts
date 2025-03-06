import { compileCodeAndIdl, MockDB, MockNAppClient } from "@n1xyz/nts-compiler";
import { readFileSync } from 'fs';
import { join } from 'path';

describe('DAOProposals App Tests', () => {
  // Import the DAOProposals contract code from the src directory
  const testCode = readFileSync(join(__dirname, '../src/dao-proposals.ts'), 'utf8');

  let client: MockNAppClient;

  const testSigner = 'test_signer';
  const testAdmin = 'test_admin';
  const testAppId = 'test_app';

  beforeAll(async () => {
    let mockDB = new MockDB();
    const { code, idl } = compileCodeAndIdl(testCode);
    client = MockNAppClient.loadClientFromCodeAndIDL(code, idl, {
      signer: testSigner,
      appAdmin: testAdmin,
      appId: testAppId,
      db: mockDB,
    });
  });

  it('should create a proposal', async () => {
    const proposalId = '1';
    const title = 'Test Proposal';
    const description = 'This is a test proposal';
    const startTime = Date.now();
    const endTime = startTime + 1000 * 60 * 60 * 24; // 1 day from now

    const result = await client.executeAction('createProposal', [proposalId, title, description, startTime, endTime]);

    expect(result.success).toBe(true);
    expect(result.transactionWrites.length).toBe(1);
    expect(result.transactionWrites[0].fieldId).toBe('proposals____1');
    expect(result.transactionWrites[0].value).toBe(JSON.stringify({
        id: proposalId,
        title,
        description,
        startTime,
        endTime,
        executed: false
    }));
  });

  it('should vote on a proposal', async () => {
    const proposal = {
        id: '1',
        title: 'Test Proposal',
        description: 'This is a test proposal',
        startTime: Date.now(),
        endTime: Date.now() + 1000 * 60 * 60 * 24, // 24 hours from start time
        executed: false
    }
    const isYay = true;

    // @ts-expect-error
    const result = await client.executeAction('vote', [proposal, isYay]);

    expect(result.success).toBe(true);
    expect(result.transactionWrites.length).toBe(1);
    expect(result.transactionWrites[0].fieldId).toBe('votes____1____test_signer');
    expect(result.transactionWrites[0].value).toBe(JSON.stringify({
        proposalId: proposal.id,
        address: testSigner,
        amount: 100,
        votedYay: isYay
    }));
  });
});