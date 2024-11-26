const { assert, expect } = require("chai"); 
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StrategyNFT Contract Tests", function () {
    // ::::::::::::: FIXTURES ::::::::::::: //  
    async function deployStrategyNftFixture() {
        const [deployer, strategyContract, user1, user2] = await ethers.getSigners();
        
        // IPFS URI pour l'image
        const baseURI = "Qma6ADzGBX22147CfKycsbNE6DYewyRhMHonDn3khc2xA6";
        
        // Déployer le contrat NFT
        const StrategyNFT = await hre.ethers.getContractFactory("StrategyNFT");
        const strategyNFT = await StrategyNFT.deploy(baseURI);
        await strategyNFT.waitForDeployment();

        return { deployer, strategyContract, user1, user2, strategyNFT, baseURI };
    }

    // ::::::::::::: DEPLOYMENT TESTS ::::::::::::: //
    describe("Deployment", function () {
        it("Should deploy with correct name and symbol", async function () {
            const { strategyNFT } = await loadFixture(deployStrategyNftFixture);
            expect(await strategyNFT.name()).to.equal("SimpliFi Strategies");
            expect(await strategyNFT.symbol()).to.equal("SFNFT");
        });

        it("Should set deployer as owner", async function () {
            const { deployer, strategyNFT } = await loadFixture(deployStrategyNftFixture);
            expect(await strategyNFT.owner()).to.equal(deployer.address);
        });
    });

    // ::::::::::::: STRATEGY CONTRACT MANAGEMENT ::::::::::::: //
    describe("Strategy Contract Management", function () {
        it("Should allow owner to set strategy contract", async function () {
            const { strategyNFT, strategyContract } = await loadFixture(deployStrategyNftFixture);
            await strategyNFT.setStrategyContract(strategyContract.address);
            expect(await strategyNFT.strategyContract()).to.equal(strategyContract.address);
        });

        it("Should revert if non-owner tries to set strategy contract", async function () {
            const { strategyNFT, strategyContract, user1 } = await loadFixture(deployStrategyNftFixture);
            await expect(
                strategyNFT.connect(user1).setStrategyContract(strategyContract.address)
            ).to.be.revertedWithCustomError(strategyNFT, "OwnableUnauthorizedAccount");
        });

        it("Should revert if trying to set zero address as strategy contract", async function () {
            const { strategyNFT } = await loadFixture(deployStrategyNftFixture);
            await expect(
                strategyNFT.setStrategyContract(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid address");
        });
    });

    // ::::::::::::: MINTING TESTS ::::::::::::: //
    describe("Minting", function () {
        it("Should allow strategy contract to mint NFT", async function () {
            const { strategyNFT, strategyContract, user1 } = await loadFixture(deployStrategyNftFixture);
            await strategyNFT.setStrategyContract(strategyContract.address);
            
            await expect(
                strategyNFT.connect(strategyContract).mintStrategyNFT(
                    user1.address,
                    ethers.parseUnits("100", 6),
                    15552000,
                    0
                )
            ).to.emit(strategyNFT, "StrategyNFTMinted");
        });

        it("Should increment token IDs correctly", async function () {
            const { strategyNFT, strategyContract, user1 } = await loadFixture(deployStrategyNftFixture);
            await strategyNFT.setStrategyContract(strategyContract.address);
            
            await strategyNFT.connect(strategyContract).mintStrategyNFT(
                user1.address,
                ethers.parseUnits("100", 6),
                15552000,
                0
            );

            expect(await strategyNFT.totalSupply()).to.equal(1);
        });

        it("Should revert if non-strategy contract tries to mint", async function () {
            const { strategyNFT, user1 } = await loadFixture(deployStrategyNftFixture);
            await expect(
                strategyNFT.connect(user1).mintStrategyNFT(
                    user1.address,
                    ethers.parseUnits("100", 6),
                    15552000,
                    0
                )
            ).to.be.revertedWith("Only strategy contract can mint");
        });
    });

    // ::::::::::::: BURNING TESTS ::::::::::::: //
    describe("Burning", function () {
        it("Should allow strategy contract to burn NFT", async function () {
            const { strategyNFT, strategyContract, user1 } = await loadFixture(deployStrategyNftFixture);
            await strategyNFT.setStrategyContract(strategyContract.address);
            
            await strategyNFT.connect(strategyContract).mintStrategyNFT(
                user1.address,
                ethers.parseUnits("100", 6),
                15552000,
                0
            );

            await expect(
                strategyNFT.connect(strategyContract).burn(1)
            ).to.emit(strategyNFT, "StrategyNFTBurned");
        });

        it("Should revert if non-strategy contract tries to burn", async function () {
            const { strategyNFT, strategyContract, user1 } = await loadFixture(deployStrategyNftFixture);
            await strategyNFT.setStrategyContract(strategyContract.address);
            
            await strategyNFT.connect(strategyContract).mintStrategyNFT(
                user1.address,
                ethers.parseUnits("100", 6),
                15552000,
                0
            );

            await expect(
                strategyNFT.connect(user1).burn(1)
            ).to.be.revertedWith("Only strategy contract can burn");
        });
    });

    // ::::::::::::: METADATA TESTS ::::::::::::: //
    describe("Metadata", function () {
        it("Should return correct tokenURI", async function () {
            const { strategyNFT, strategyContract, user1, baseURI } = await loadFixture(deployStrategyNftFixture);
            await strategyNFT.setStrategyContract(strategyContract.address);
            
            await strategyNFT.connect(strategyContract).mintStrategyNFT(
                user1.address,
                ethers.parseUnits("100", 6),
                15552000,
                0
            );

            const tokenURI = await strategyNFT.tokenURI(1);
            expect(tokenURI).to.include("data:application/json;base64,");
            
            // Décoder le Base64 pour vérifier le contenu
            const base64Data = tokenURI.split('base64,')[1];
            const decodedData = Buffer.from(base64Data, 'base64').toString();
            const metadata = JSON.parse(decodedData);
            
            // Vérifier que l'URL de l'image est correcte
            expect(metadata.image).to.equal(`https://ipfs.io/ipfs/${baseURI}`);
        });

        it("Should revert tokenURI query for non-existent token", async function () {
            const { strategyNFT } = await loadFixture(deployStrategyNftFixture);
            await expect(
                strategyNFT.tokenURI(1)
            ).to.be.revertedWith("Token does not exist");  // Utiliser le message d'erreur exact du contrat
        });
    });
});