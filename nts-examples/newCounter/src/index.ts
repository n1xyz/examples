import { _mint, _mintTransfer, _transfer, _withdraw, createExecutableFunctions, NApp } from "@n1xyz/nts-sdk";

class Counter extends NApp {
  withdraw(
    amount: string | number | bigint,
    mint: string,
    destinationAppId: string,
    receiverOpt?: string
  ) {
    _withdraw(BigInt(amount), mint, destinationAppId, receiverOpt);
  }

  mintTransfer(
    amount: string | number | bigint,
    mint: string,
    destination: string
  ) {
    _mintTransfer(BigInt(amount), mint, destination);
  }

  mint(
    totalSupply: string | number | bigint, 
    admin: string, 
    meta: any
  ) {
    _mint(BigInt(totalSupply), admin, meta);
  }

  transfer(
    amount: string | number | bigint,
    mint: string,
    receiver: string
  ) {
    _transfer(BigInt(amount), mint, receiver);
  }

  /*
  Your code here
  */
}

export const {mint,transfer,withdraw,mintTransfer} = createExecutableFunctions(Counter)
