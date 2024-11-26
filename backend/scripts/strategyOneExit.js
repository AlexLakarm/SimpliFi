const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAddresses } = require("../config/addresses");

async function main() {
    const [deployer, admin, cgp, client] = await ethers.getSigners();
    const addresses = getAddresses();

    const strategyOne = await ethers.getContractAt("StrategyOne", addresses.strategyOne);
    const strategyNFT = await ethers.getContractAt("StrategyNFT", addresses.strategyNFT);

    // Utiliser le même ID pour la position et le NFT
    const positionId = 0; // Les positions commencent à 0

    console.log("\nNFT Status Before Exit:");
    const owner = await strategyNFT.ownerOf(positionId + 1); // NFT ID = position ID + 1
    console.log("NFT Owner:", owner);
    const tokenURI = await strategyNFT.tokenURI(positionId + 1); // NFT ID = position ID + 1
    console.log("NFT Metadata:", tokenURI);

    // Avancer le temps
    console.log("\nAdvancing time...");
    await ethers.provider.send("evm_increaseTime", [250 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    console.log("Time advanced by 250 days");

    // Sortir de la stratégie avec l'ID de position original
    console.log("\nExiting strategy...");
    const exitTx = await strategyOne.connect(client).exitStrategy(positionId);
    const exitReceipt = await exitTx.wait();

    // Récupérer l'événement de burn du NFT
    const burnEvent = exitReceipt.logs.find(
        log => {
            try {
                const parsedLog = strategyNFT.interface.parseLog(log);
                return parsedLog && parsedLog.name === 'StrategyNFTBurned';
            } catch {
                return false;
            }
        }
    );

    if (burnEvent) {
        const parsedBurnEvent = strategyNFT.interface.parseLog(burnEvent);
        console.log("\nNFT Burn Details:");
        console.log("Burned Token ID:", parsedBurnEvent.args.tokenId.toString());
        console.log("Burn Timestamp:", new Date(Number(parsedBurnEvent.args.timestamp) * 1000).toLocaleString());
    } else {
        console.log("\nWarning: NFT Burn event not found");
        console.log("All events:", exitReceipt.logs.map(log => {
            try {
                return strategyNFT.interface.parseLog(log);
            } catch {
                return "Unparseable log";
            }
        }));
    }

    // Vérifier que le NFT n'existe plus
    try {
        await strategyNFT.ownerOf(positionId + 1); // NFT ID = position ID + 1
        console.log("Error: NFT still exists!");
    } catch (error) {
        console.log("✓ NFT successfully burned");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 