import { _mint, _mintTransfer, _transfer, _withdraw, createExecutableFunctions, NApp, NMap } from "@n1xyz/nts-compiler";

interface Pool {
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

export class AmmApp extends NApp {
  private pools: NMap<Pool>;

  constructor() {
    super();
    this.pools = new NMap(this, "pools");
  }

  init() {
    this.log("[LOG]:initializing AMM, at:" + this.time());
    // Initialize state if needed
  }

  createPool(
    token0: string,
    token1: string,
    amount0: string | number | bigint,
    amount1: string | number | bigint
  ) {
    this.log("[LOG]:creating pool, at:" + this.time());
    
    // Ensure tokens are in canonical order
    if (token0 > token1) {
      [token0, token1] = [token1, token0];
      [amount0, amount1] = [amount1, amount0];
    }

    const poolId = this.getPoolId(token0, token1);
    if (this.pools.has(poolId)) {
      throw new Error("Pool already exists");
    }

    const amt0 = BigInt(amount0);
    const amt1 = BigInt(amount1);
    
    // Transfer tokens to the pool
    _transfer(amt0, token0, this.appId());
    _transfer(amt1, token1, this.appId());

    // Calculate initial LP tokens (sqrt of token amounts)
    const lpTokens = this.sqrt(amt0 * amt1);

    // Create pool
    this.pools.set(poolId, {
      token0,
      token1,
      reserve0: amt0,
      reserve1: amt1,
      totalSupply: lpTokens
    });

    // Mint LP tokens to the creator
    _mint(lpTokens, this.signer(), {
      poolId,
      token0,
      token1
    });
  }

  addLiquidity(
    token0: string,
    token1: string,
    amount0Desired: string | number | bigint,
    amount1Desired: string | number | bigint
  ) {
    this.log("[LOG]:adding liquidity, at:" + this.time());
    
    // Ensure tokens are in canonical order
    if (token0 > token1) {
      [token0, token1] = [token1, token0];
      [amount0Desired, amount1Desired] = [amount1Desired, amount0Desired];
    }

    const poolId = this.getPoolId(token0, token1);
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error("Pool does not exist");
    }

    const amt0 = BigInt(amount0Desired);
    const amt1 = BigInt(amount1Desired);

    // Calculate optimal amounts
    const amount1Optimal = (amt0 * pool.reserve1) / pool.reserve0;
    const amount0Optimal = (amt1 * pool.reserve0) / pool.reserve1;

    let amount0: bigint;
    let amount1: bigint;

    if (amount1Optimal <= amt1) {
      amount0 = amt0;
      amount1 = amount1Optimal;
    } else {
      amount0 = amount0Optimal;
      amount1 = amt1;
    }

    // Transfer tokens to the pool
    _transfer(amount0, token0, this.appId());
    _transfer(amount1, token1, this.appId());

    // Calculate LP tokens to mint
    const lpTokens = (amount0 * pool.totalSupply) / pool.reserve0;

    // Update pool reserves
    pool.reserve0 += amount0;
    pool.reserve1 += amount1;
    pool.totalSupply += lpTokens;

    // Update pool state
    this.pools.set(poolId, pool);

    // Mint LP tokens
    _mint(lpTokens, this.signer(), {
      poolId,
      token0,
      token1
    });
  }

  removeLiquidity(
    token0: string,
    token1: string,
    lpTokens: string | number | bigint
  ) {
    this.log("[LOG]:removing liquidity, at:" + this.time());
    
    // Ensure tokens are in canonical order
    if (token0 > token1) {
      [token0, token1] = [token1, token0];
    }

    const poolId = this.getPoolId(token0, token1);
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error("Pool does not exist");
    }

    const tokens = BigInt(lpTokens);
    
    // Calculate amounts to return
    const amount0 = (tokens * pool.reserve0) / pool.totalSupply;
    const amount1 = (tokens * pool.reserve1) / pool.totalSupply;

    // Update pool reserves
    pool.reserve0 -= amount0;
    pool.reserve1 -= amount1;
    pool.totalSupply -= tokens;

    // Update pool state
    this.pools.set(poolId, pool);

    // Burn LP tokens
    _withdraw(tokens, poolId, this.appId());

    // Return tokens
    _transfer(amount0, token0, this.signer());
    _transfer(amount1, token1, this.signer());
  }

  swap(
    amountIn: string | number | bigint,
    tokenIn: string,
    tokenOut: string
  ) {
    this.log("[LOG]:swapping, at:" + this.time());
    
    // Ensure tokens are in canonical order for pool lookup
    const [token0, token1] = tokenIn < tokenOut ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
    const isToken0In = tokenIn === token0;

    const poolId = this.getPoolId(token0, token1);
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error("Pool does not exist");
    }

    const amount = BigInt(amountIn);
    
    // Transfer input tokens to pool
    _transfer(amount, tokenIn, this.appId());

    // Calculate output amount with 0.3% fee
    const amountInWithFee = amount * BigInt(997);
    const reserveIn = isToken0In ? pool.reserve0 : pool.reserve1;
    const reserveOut = isToken0In ? pool.reserve1 : pool.reserve0;
    
    const amountOut = (amountInWithFee * reserveOut) / (reserveIn * BigInt(1000) + amountInWithFee);

    // Update reserves
    if (isToken0In) {
      pool.reserve0 += amount;
      pool.reserve1 -= amountOut;
    } else {
      pool.reserve1 += amount;
      pool.reserve0 -= amountOut;
    }

    // Update pool state
    this.pools.set(poolId, pool);

    // Transfer output tokens to sender
    _transfer(amountOut, tokenOut, this.signer());
  }

  // Helper functions
  private getPoolId(token0: string, token1: string): string {
    return `${token0}-${token1}`;
  }

  private sqrt(value: bigint): bigint {
    if (value < BigInt(0)) {
      throw new Error("Square root of negative numbers is not supported");
    }
    if (value < BigInt(2)) {
      return value;
    }

    let x = value / BigInt(2);
    let y = (x + value / x) / BigInt(2);

    while (y < x) {
      x = y;
      y = (x + value / x) / BigInt(2);
    }
    return x;
  }

  withdraw(
    amount: string | number | bigint,
    mint: string,
    destinationAppId: string,
    receiverOpt?: string
  ) {
    this.log("[LOG]:withdrawing, at:" + this.time());
    _withdraw(BigInt(amount), mint, destinationAppId, receiverOpt);
  }

  mintTransfer(
    amount: string | number | bigint,
    mint: string,
    destination: string
  ) {
    this.log("[LOG]:mint transfer, at:" + this.time());
    _mintTransfer(BigInt(amount), mint, destination);
  }

  mint(
    totalSupply: string | number | bigint,
    admin: string,
    meta: any
  ) {
    this.log("[LOG]:mint, at:" + this.time());
    _mint(BigInt(totalSupply), admin, meta);
  }

  transfer(
    amount: string | number | bigint,
    mint: string,
    receiver: string
  ) {
    this.log("[LOG]:transfer, at:" + this.time());
    _transfer(BigInt(amount), mint, receiver);
  }
}

export const { 
  init,
  createPool,
  addLiquidity,
  removeLiquidity,
  swap,
  mint,
  mintTransfer,
  transfer,
  withdraw
} = createExecutableFunctions(AmmApp);
