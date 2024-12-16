const hre = require("hardhat");
const { getAddresses, updateAddresses } = require("../../config/addresses");

async function main() {
    // Récupérer le déployeur
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
    console.log("Network:", network.name);

    console.log("Starting StrategyOne deployment on Holesky...");

    // Récupérer les adresses des contrats mock Pendle pour Holesky
    const mockAddresses = getAddresses("holesky");
    console.log("Using Holesky contracts:", mockAddresses);

    // Vérifier que toutes les adresses nécessaires sont présentes
    if (!mockAddresses.router || !mockAddresses.oracle || !mockAddresses.roleControl || !mockAddresses.strategyNFT) {
        throw new Error("Missing required contract addresses. Make sure all contracts are deployed on Holesky first.");
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
    const strategyOneReceipt = await strategyOne.deploymentTransaction().wait(2);
    
    console.log(`StrategyOne deployed to: ${strategyOne.target}`);
    console.log(`Gas used: ${strategyOneReceipt.gasUsed}`);

    try {
        // Configurer l'adresse de StrategyOne dans le NFT
        console.log("\nConfiguring StrategyOne address in NFT contract...");
        const strategyNFT = await ethers.getContractAt("StrategyNFT", mockAddresses.strategyNFT);
        const setStrategyTx = await strategyNFT.setStrategyContract(strategyOne.target);
        await setStrategyTx.wait(2);
        console.log("✓ StrategyOne address set in NFT contract");

        // Sauvegarder l'adresse
        const addresses = {
            ...mockAddresses,
            strategyOne: strategyOne.target
        };
        updateAddresses(addresses, "holesky");

        // Vérification du contrat sur Etherscan
        console.log("\nVerifying contract on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: strategyOne.target,
                constructorArguments: [
                    mockAddresses.router,
                    mockAddresses.oracle,
                    mockAddresses.roleControl,
                    mockAddresses.strategyNFT
                ]
            });
            console.log("✓ Contract verified on Etherscan");
        } catch (error) {
            console.error("Error during contract verification:", error);
            console.log("You may need to verify the contract manually");
        }

        console.log("\nDeployment completed successfully on Holesky!");
        console.log("\nDeployed Addresses:");
        console.log("StrategyOne:", strategyOne.target);
        console.log("NFT:", mockAddresses.strategyNFT);
        console.log("Router:", mockAddresses.router);
        console.log("Oracle:", mockAddresses.oracle);
        console.log("RoleControl:", mockAddresses.roleControl);

        return addresses;

    } catch (error) {
        console.error("Error during post-deployment configuration:", error);
        throw error;
    }
}

// Gestion des erreurs améliorée
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error in deployment script:");
        console.error(error);
        process.exit(1);
    }); 