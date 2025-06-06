import { createExecutableFunctions, NApp } from "@n1xyz/nts-compiler";

class Counter extends NApp {
  count: number;
  
  init(): void { 
    this.log('Initializing Counter app');
    this.count = 0; 
    this.log('Counter initialized with count:', this.count);
  }
  
  increment(by: number = 1): void {
    this.log('Increment called with value:', by);
    this.log('Current count before increment:', this.count);
    
    if (by < 0) {
      this.log('ERROR: Negative increment value provided:', by);
      throw new Error('Increment value must be non-negative');
    }
    
    if (by === 0) {
      this.log('WARNING: Zero increment value provided, no change will occur');
    }
    
    const oldCount = this.count;
    this.count += by;
    
    this.log('Count incremented successfully:', {
      oldValue: oldCount,
      incrementBy: by,
      newValue: this.count
    });
  }
  
  decrement(by: number = 1): void {
    this.log('Decrement called with value:', by);
    this.log('Current count before decrement:', this.count);
    
    if (by < 0) {
      this.log('ERROR: Negative decrement value provided:', by);
      throw new Error('Decrement value must be non-negative');
    }
    
    if (by === 0) {
      this.log('WARNING: Zero decrement value provided, no change will occur');
    }
    
    if (this.count - by < 0) {
      this.log('WARNING: Decrement would result in negative count:', {
        currentCount: this.count,
        decrementBy: by,
        resultWouldBe: this.count - by
      });
    }
    
    const oldCount = this.count;
    this.count -= by;
    
    this.log('Count decremented successfully:', {
      oldValue: oldCount,
      decrementBy: by,
      newValue: this.count
    });
  }
}

export const { init, increment, decrement } = createExecutableFunctions(Counter);
