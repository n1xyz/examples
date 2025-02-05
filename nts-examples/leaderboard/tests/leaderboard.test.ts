import { clearMockStorage, createExecutableFunctions, getMockStorageByTag, injectMockStorage, printStorage } from '@n1xyz/nts-sdk/src';
import { Leaderboard } from '../src/leaderboard';

// Setup mock storage
injectMockStorage(Leaderboard);

function test() {
  const {addScore,getScore,getTopPlayers,resetScore,resetAllScores} = createExecutableFunctions(Leaderboard,"leaderboard")
  console.log('Starting leaderboard tests...');
  
  // Clear storage before tests
  clearMockStorage();
  
  // Test adding scores
  addScore('alice', 100);
  addScore('bob', 50);
  addScore('charlie', 75);
  addScore('alice', 25);  // Alice gets more points

  // Test getting individual scores
  console.log('Individual scores:');
  console.log('Alice:', getScore('alice'));
  console.log('Bob:', getScore('bob'));
  console.log('Charlie:', getScore('charlie'));
  
  // Test top players
  console.log('\nTop players:');
  const topPlayers = getTopPlayers(3);
  topPlayers.forEach(([player, score], index) => {
    console.log(`${index + 1}. ${player}: ${score}`);
  });

  // Test reset
  console.log('\nResetting Bob\'s score...');
  resetScore('bob');
  console.log('Bob\'s new score:', getScore('bob'));

  // Test tag tracking
  const scoreUpdates = getMockStorageByTag('score_update');
  const scoreResets = getMockStorageByTag('score_reset');
  
  console.log('\nScore updates:', Object.keys(scoreUpdates).length);
  console.log('Score resets:', Object.keys(scoreResets).length);

  // Reset all scores
  resetAllScores();
  const allResets = getMockStorageByTag('score_reset_all');
  console.log('All score resets:', Object.keys(allResets).length);

  // Assertions
  console.assert(getScore('alice') === 0, 'All scores should be reset');
  console.assert(Object.keys(scoreUpdates).length === 4, 'Should have 4 score updates');
  console.assert(Object.keys(scoreResets).length === 1, 'Should have 1 individual reset');
  console.assert(Object.keys(allResets).length > 0, 'Should have reset all operation');

  console.log('\nTests completed!');
  printStorage();
}

// Run tests
test(); 