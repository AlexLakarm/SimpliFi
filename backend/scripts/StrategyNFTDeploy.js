const hre = require("hardhat");
const { getAddresses, updateAddresses } = require("../config/addresses");

async function main() {
    console.log("Starting StrategyNFT deployment...");

    // CID de l'image IPFS (sans le préfixe ipfs:// ni https://ipfs.io/ipfs/)
    const baseURI = "Qma6ADzGBX22147CfKycsbNE6DYewyRhMHonDn3khc2xA6";

    // Déployer le contrat NFT
    console.log("\nDeploying StrategyNFT...");
    const strategyNFT = await hre.ethers.deployContract("StrategyNFT", [baseURI]);
    await strategyNFT.waitForDeployment();
    console.log(`StrategyNFT deployed to: ${strategyNFT.target}`);

    // Récupérer les adresses existantes
    const addresses = getAddresses();

    // Mettre à jour les adresses
    const updatedAddresses = {
        ...addresses,
        strategyNFT: strategyNFT.target
    };
    updateAddresses(updatedAddresses);

    console.log("\nDeployment completed!");
    console.log("Updated addresses:", updatedAddresses);
    console.log("\nNOTE: Don't forget to call setStrategyContract on the NFT contract after StrategyOne is deployed");

    return updatedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 