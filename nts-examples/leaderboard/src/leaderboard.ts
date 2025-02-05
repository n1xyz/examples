import { NApp, NMap, createExecutableFunctions } from "@n1xyz/nts-sdk/src";

export class Leaderboard extends NApp {
  private scores = new NMap<number>(this, "scores");

  constructor() {
    super("leaderboard");
  }
  
  getScore(player: string): number {
    return this.scores.get(player) || 0;
  }
  
  getTopPlayers(limit: number = 10): Array<[string, number]> {
    return Array.from(this.scores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
  }
  
  addScore(player: string, points: number): void {
    const currentScore = this.scores.get(player) || 0;
    this.scores.set(player, currentScore + points);
  }
  
  resetScore(player: string): void {
    this.scores.set(player, 0);
  }
  
  resetAllScores(): void {
    this.scores.clear("score_reset_all");
  }
}

// Create executable methods
export const {
  addScore,
  resetScore,
  resetAllScores
} = createExecutableFunctions(Leaderboard, "leaderboard"); 
