const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAddresses } = require("../config/addresses");

async function main() {
    const [deployer, admin, cgp, client] = await ethers.getSigners();
    console.log("Testing with accounts:");
    console.log("Client:", client.address);

    const addresses = getAddresses();
    console.log("\nUsing addresses:", addresses);

    const gUSDC = await ethers.getContractAt("gUSDC", addresses.gUSDC);
    const strategyOne = await ethers.getContractAt("StrategyOne", addresses.strategyOne);
    const strategyNFT = await ethers.getContractAt("StrategyNFT", addresses.strategyNFT);

    // Transférer des gUSDC au client
    const amount = ethers.parseUnits("100", 6);
    await gUSDC.transfer(client.address, amount);
    console.log("\nTransferred 100 gUSDC to client");

    // Entrer dans la stratégie
    console.log("\nEntering strategy...");
    
    // Vérifier l'allowance actuelle
    const currentAllowance = await gUSDC.allowance(client.address, addresses.strategyOne);
    console.log("Current allowance:", ethers.formatUnits(currentAllowance, 6), "gUSDC");

    // Approuver StrategyOne pour dépenser les gUSDC
    await gUSDC.connect(client).approve(addresses.strategyOne, amount);
    console.log("Approved StrategyOne to spend", ethers.formatUnits(amount, 6), "gUSDC");

    // Vérifier la nouvelle allowance
    const newAllowance = await gUSDC.allowance(client.address, addresses.strategyOne);
    console.log("New allowance:", ethers.formatUnits(newAllowance, 6), "gUSDC");

    // Vérifier le solde gUSDC du client
    const balance = await gUSDC.balanceOf(client.address);
    console.log("Client gUSDC balance:", ethers.formatUnits(balance, 6), "gUSDC");

    // Entrer dans la stratégie
    const enterTx = await strategyOne.connect(client).enterStrategy(amount);
    const enterReceipt = await enterTx.wait();

    // Récupérer les événements
    const enterEvent = enterReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'StrategyEntered'
    );

    console.log("\nStrategy Entry Details:");
    console.log("Position ID:", enterEvent.args.positionId.toString());
    console.log("Amount Invested:", ethers.formatUnits(enterEvent.args.amount, 6), "gUSDC");
    console.log("PT Received:", ethers.formatUnits(enterEvent.args.ptReceived, 6), "PT");

    // Récupérer l'événement de mint du NFT depuis le contrat NFT
    const mintEvent = enterReceipt.logs.find(
        log => {
            const strategyNFTInterface = new ethers.Interface([
                "event StrategyNFTMinted(address indexed owner, uint256 indexed tokenId, uint256 initialAmount, uint256 duration, uint256 strategyId, uint256 timestamp)"
            ]);
            try {
                return strategyNFTInterface.parseLog(log) !== null;
            } catch {
                return false;
            }
        }
    );

    if (mintEvent) {
        const parsedMintEvent = strategyNFT.interface.parseLog(mintEvent);
        console.log("\nNFT Details:");
        console.log("NFT Token ID:", parsedMintEvent.args.tokenId.toString());
        console.log("NFT Owner:", parsedMintEvent.args.owner);
        console.log("NFT Contract Address:", addresses.strategyNFT);

        // Récupérer et décoder le tokenURI
        const tokenURI = await strategyNFT.tokenURI(parsedMintEvent.args.tokenId);
        console.log("\nRaw TokenURI:", tokenURI);

        // Décoder le Base64 si le tokenURI commence par "data:application/json;base64,"
        if (tokenURI.startsWith("data:application/json;base64,")) {
            const base64Json = tokenURI.replace("data:application/json;base64,", "");
            const decodedJson = Buffer.from(base64Json, 'base64').toString('utf8');
            console.log("\nDecoded JSON Metadata:");
            console.log(JSON.parse(decodedJson));
        }

        console.log("\nYou can now import this NFT in MetaMask:");
        console.log("1. Open MetaMask");
        console.log("2. Select the Hardhat network");
        console.log("3. Click 'Import NFTs'");
        console.log("4. Enter the contract address:", addresses.strategyNFT);
        console.log("5. Enter the token ID:", parsedMintEvent.args.tokenId.toString());
    } else {
        console.log("\nWarning: NFT Mint event not found");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 