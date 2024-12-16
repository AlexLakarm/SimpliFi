const hre = require("hardhat");
const { getAddresses, updateAddresses } = require("../../config/addresses");

async function main() {
    // Récupérer le déployeur
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
    console.log("Network:", network.name);

    console.log("Starting StrategyNFT deployment on Holesky...");

    // CID de l'image IPFS (sans le préfixe ipfs:// ni https://ipfs.io/ipfs/)
    const baseURI = "Qma6ADzGBX22147CfKycsbNE6DYewyRhMHonDn3khc2xA6";

    // Déployer le contrat NFT
    console.log("\nDeploying StrategyNFT...");
    const strategyNFT = await hre.ethers.deployContract("StrategyNFT", [baseURI]);
    await strategyNFT.waitForDeployment();
    const strategyNFTReceipt = await strategyNFT.deploymentTransaction().wait(2);
    
    console.log(`StrategyNFT deployed to: ${strategyNFT.target}`);
    console.log(`Gas used: ${strategyNFTReceipt.gasUsed}`);

    // Récupérer les adresses existantes pour Holesky
    const addresses = getAddresses("holesky");

    // Mettre à jour les adresses
    const updatedAddresses = {
        ...addresses,
        strategyNFT: strategyNFT.target
    };
    updateAddresses(updatedAddresses, "holesky");

    // Vérification du contrat sur Etherscan
    console.log("\nVerifying contract on Etherscan...");
    try {
        await hre.run("verify:verify", {
            address: strategyNFT.target,
            constructorArguments: [baseURI]
        });
        console.log("✓ Contract verified on Etherscan");
    } catch (error) {
        console.error("Error during contract verification:", error);
        console.log("You may need to verify the contract manually");
    }

    console.log("\nDeployment completed successfully on Holesky!");
    console.log("Updated addresses:", updatedAddresses);
    console.log("\nIMPORTANT: Don't forget to call setStrategyContract on the NFT contract after StrategyOne is deployed");

    return updatedAddresses;
}

// Gestion des erreurs améliorée
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error in deployment script:");
        console.error(error);
        process.exit(1);
    }); 