const hre = require("hardhat");
const { getAddresses, updateAddresses } = require("../config/addresses");

async function main() {
    console.log("Starting StrategyOne deployment...");

    // Récupérer les adresses des contrats mock Pendle
    const mockAddresses = getAddresses();
    console.log("Using mock contracts:", mockAddresses);

    // Vérifier que toutes les adresses nécessaires sont présentes
    if (!mockAddresses.router || !mockAddresses.oracle || !mockAddresses.roleControl) {
        throw new Error("Missing required contract addresses");
    }

    // Déployer StrategyOne avec l'adresse du NFT
    console.log("\nDeploying StrategyOne...");
    const strategyOne = await hre.ethers.deployContract("StrategyOne", [
        mockAddresses.router,
        mockAddresses.oracle,
        mockAddresses.roleControl,
        mockAddresses.strategyNFT
    ]);
    await strategyOne.waitForDeployment();
    console.log(`StrategyOne deployed to: ${strategyOne.target}`);

    // Configurer l'adresse de StrategyOne dans le NFT
    const strategyNFT = await ethers.getContractAt("StrategyNFT", mockAddresses.strategyNFT);
    await strategyNFT.setStrategyContract(strategyOne.target);
    console.log("StrategyOne address set in NFT contract");

    // Sauvegarder l'adresse
    const addresses = {
        ...mockAddresses,
        strategyOne: strategyOne.target
    };
    updateAddresses(addresses);

    console.log("\nDeployment completed!");
    console.log("Updated addresses:", addresses);

    return addresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 