
import { MockNAppClient } from "@n1xyz/nts-compiler";

(async () => {
    const client = await MockNAppClient.loadClientFromPath(`src/index.ts`, {
        signer: "0x123",
        appAdmin: "0x123",
        appId: "0x123"
    })


    const result = await client.executeAction("mint", [100000, "0x123", {}])
    console.log(JSON.stringify(result, null, 2))
})()