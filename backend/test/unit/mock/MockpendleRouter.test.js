const { assert, expect } = require("chai"); 
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MockPendleRouter Contract Tests", function () {
    // ::::::::::::: FIXTURES ::::::::::::: //  
    async function deployMockPendleRouterFixture() {
        const [deployer, user1, user2] = await ethers.getSigners();
        
        // Déployer d'abord les contrats nécessaires
        const gUSDC = await hre.ethers.deployContract("gUSDC", [ethers.parseUnits("1000000", 6)]);
        await gUSDC.waitForDeployment();

        const ptgUSDC = await hre.ethers.deployContract("PtgUSDC");
        await ptgUSDC.waitForDeployment();

        const mockPendleOracle = await hre.ethers.deployContract("MockPendleOracle");
        await mockPendleOracle.waitForDeployment();

        // Déployer le MockPendleRouter avec les adresses des contrats
        const mockPendleRouter = await hre.ethers.deployContract("MockPendleRouter", [
            gUSDC.target,
            ptgUSDC.target,
            mockPendleOracle.target
        ]);
        await mockPendleRouter.waitForDeployment();

        // Transférer l'ownership de PtgUSDC au router
        await ptgUSDC.transferOwnership(mockPendleRouter.target);

        // Configurer le router dans gUSDC
        await gUSDC.setRouterAddress(mockPendleRouter.target);

        // Initialiser l'oracle avec les paramètres de test
        const annualYieldPoints = 10; // 10%
        const duration = 180; // 180 jours directement, plus besoin de multiplier
        
        await mockPendleOracle.setRateAndPrice(ptgUSDC.target, annualYieldPoints);
        await mockPendleOracle.setDuration(ptgUSDC.target, duration);

        return { 
            deployer, 
            user1, 
            user2, 
            gUSDC, 
            ptgUSDC, 
            mockPendleOracle, 
            mockPendleRouter,
            annualYieldPoints,
            duration
        };
    }

    // ::::::::::::: DEPLOYMENT TESTS ::::::::::::: //
    describe("Deployment", function () {
        it("Should set correct addresses", async function () {
            const { mockPendleRouter, gUSDC, ptgUSDC } = await loadFixture(deployMockPendleRouterFixture);
            expect(await mockPendleRouter.gUSDC()).to.equal(gUSDC.target);
            expect(await mockPendleRouter.PTgUSDC()).to.equal(ptgUSDC.target);
        });

        it("Should set deployer as owner", async function () {
            const { mockPendleRouter, deployer } = await loadFixture(deployMockPendleRouterFixture);
            expect(await mockPendleRouter.owner()).to.equal(deployer.address);
        });
    });

    // ::::::::::::: SWAP TESTS ::::::::::::: //
    describe("Swap Token for PT", function () {
        it("Should allow swapping gUSDC for PT", async function () {
            const { mockPendleRouter, gUSDC, ptgUSDC, user1 } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);

            // Transférer des gUSDC à l'utilisateur
            await gUSDC.transfer(user1.address, amount);
            await gUSDC.connect(user1).approve(mockPendleRouter.target, amount);

            // Effectuer le swap
            const tx = await mockPendleRouter.connect(user1).swapExactTokenForPt(gUSDC.target, amount);
            const receipt = await tx.wait();

            // Vérifier l'événement Swapped
            const swapEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'Swapped'
            );
            expect(swapEvent.args.inputToken).to.equal(gUSDC.target);
            expect(swapEvent.args.outputToken).to.equal(ptgUSDC.target);
            expect(swapEvent.args.inputAmount).to.equal(amount);
        });

        it("Should revert if amount is zero", async function () {
            const { mockPendleRouter, gUSDC, user1 } = await loadFixture(deployMockPendleRouterFixture);
            await expect(
                mockPendleRouter.connect(user1).swapExactTokenForPt(gUSDC.target, 0)
            ).to.be.revertedWithCustomError(mockPendleRouter, "MarketZeroAmountsInput");
        });

        it("Should revert if token address is zero", async function () {
            const { mockPendleRouter, user1 } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);
            await expect(
                mockPendleRouter.connect(user1).swapExactTokenForPt(ethers.ZeroAddress, amount)
            ).to.be.revertedWithCustomError(mockPendleRouter, "ZeroAddress");
        });

        it("Should revert if insufficient allowance", async function () {
            const { mockPendleRouter, gUSDC, user1 } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);
            await gUSDC.transfer(user1.address, amount);
            // Ne pas donner l'approbation
            await expect(
                mockPendleRouter.connect(user1).swapExactTokenForPt(gUSDC.target, amount)
            ).to.be.revertedWithCustomError(mockPendleRouter, "InsufficientAllowance");
        });
    });

    // ::::::::::::: REDEEM TESTS ::::::::::::: //
    describe("Redeem PT to Token", function () {
        it("Should revert if trying to redeem before maturity", async function () {
            const { mockPendleRouter, gUSDC, ptgUSDC, user1 } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);

            // Setup
            await gUSDC.transfer(user1.address, amount);
            await gUSDC.connect(user1).approve(mockPendleRouter.target, amount);
            const swapTx = await mockPendleRouter.connect(user1).swapExactTokenForPt(gUSDC.target, amount);
            const swapReceipt = await swapTx.wait();

            // Récupérer la date de maturité depuis l'événement Swapped
            const swapEvent = swapReceipt.logs.find(
                log => log.fragment && log.fragment.name === 'Swapped'
            );
            const maturityDate = swapEvent.args.maturityDate;

            // Essayer de redeem immédiatement (avant la maturité)
            await expect(
                mockPendleRouter.connect(user1).redeemPyToToken(gUSDC.target, maturityDate)
            ).to.be.revertedWithCustomError(mockPendleRouter, "YCNotExpired");
        });

        it("Should allow redeeming PT for gUSDC at maturity", async function () {
            const { mockPendleRouter, gUSDC, ptgUSDC, user1 } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);

            // Setup: Faire un swap d'abord
            await gUSDC.transfer(user1.address, amount);
            await gUSDC.connect(user1).approve(mockPendleRouter.target, amount);
            const swapTx = await mockPendleRouter.connect(user1).swapExactTokenForPt(gUSDC.target, amount);
            const swapReceipt = await swapTx.wait();

            // Récupérer la date de maturité depuis l'événement Swapped
            const swapEvent = swapReceipt.logs.find(
                log => log.fragment && log.fragment.name === 'Swapped'
            );
            const maturityDate = swapEvent.args.maturityDate;

            // Avancer le temps juste après la maturité
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(maturityDate) + 1]);
            await ethers.provider.send("evm_mine");

            // Approuver le router pour les PT
            const ptBalance = await ptgUSDC.balanceOf(user1.address);
            await ptgUSDC.connect(user1).approve(mockPendleRouter.target, ptBalance);

            // Effectuer le redeem avec la bonne date de maturité
            const tx = await mockPendleRouter.connect(user1).redeemPyToToken(gUSDC.target, maturityDate);
            const receipt = await tx.wait();

            // Vérifier l'événement PtRedeemed
            const redeemEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'PtRedeemed'
            );
            expect(redeemEvent.args.user).to.equal(user1.address);
        });

        it("Should revert if trying to redeem after market expiration", async function () {
            const { mockPendleRouter, gUSDC, ptgUSDC, user1 } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);

            // Setup
            await gUSDC.transfer(user1.address, amount);
            await gUSDC.connect(user1).approve(mockPendleRouter.target, amount);
            const swapTx = await mockPendleRouter.connect(user1).swapExactTokenForPt(gUSDC.target, amount);
            const swapReceipt = await swapTx.wait();

            // Récupérer la date de maturité
            const swapEvent = swapReceipt.logs.find(
                log => log.fragment && log.fragment.name === 'Swapped'
            );
            const maturityDate = swapEvent.args.maturityDate;

            // Avancer le temps après l'expiration (maturity + 366 jours)
            await ethers.provider.send("evm_setNextBlockTimestamp", [Number(maturityDate) + 366 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            // Essayer de redeem après expiration
            await expect(
                mockPendleRouter.connect(user1).redeemPyToToken(gUSDC.target, maturityDate)
            ).to.be.revertedWithCustomError(mockPendleRouter, "MarketExpired");
        });
    });

    // ::::::::::::: TOKEN TO PT MAPPING TESTS ::::::::::::: //
    describe("Token to PT Mapping", function () {
        it("Should allow owner to set token to PT mapping", async function () {
            const { mockPendleRouter, deployer, gUSDC, ptgUSDC } = await loadFixture(deployMockPendleRouterFixture);
            await mockPendleRouter.connect(deployer).setTokenToPt(gUSDC.target, ptgUSDC.target);
            expect(await mockPendleRouter.tokenToPt(gUSDC.target)).to.equal(ptgUSDC.target);
        });

        it("Should revert if non-owner tries to set token to PT mapping", async function () {
            const { mockPendleRouter, user1, gUSDC, ptgUSDC } = await loadFixture(deployMockPendleRouterFixture);
            await expect(
                mockPendleRouter.connect(user1).setTokenToPt(gUSDC.target, ptgUSDC.target)
            ).to.be.revertedWithCustomError(mockPendleRouter, "OwnableUnauthorizedAccount");
        });

        it("Should revert if trying to set zero address as token", async function () {
            const { mockPendleRouter, deployer, ptgUSDC } = await loadFixture(deployMockPendleRouterFixture);
            await expect(
                mockPendleRouter.connect(deployer).setTokenToPt(ethers.ZeroAddress, ptgUSDC.target)
            ).to.be.revertedWithCustomError(mockPendleRouter, "ZeroAddress");
        });

        it("Should revert if trying to set zero address as PT", async function () {
            const { mockPendleRouter, deployer, gUSDC } = await loadFixture(deployMockPendleRouterFixture);
            await expect(
                mockPendleRouter.connect(deployer).setTokenToPt(gUSDC.target, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(mockPendleRouter, "ZeroAddress");
        });
    });

    // ::::::::::::: RESCUE FUNCTIONS TESTS ::::::::::::: //
    describe("Rescue Functions", function () {
        it("Should allow owner to rescue PT tokens", async function () {
            const { mockPendleRouter, deployer, gUSDC, ptgUSDC } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);

            // D'abord transférer des gUSDC au router
            await gUSDC.transfer(mockPendleRouter.target, amount);

            // Faire un swap via le router pour générer des PT tokens
            await gUSDC.connect(deployer).approve(mockPendleRouter.target, amount);
            await mockPendleRouter.connect(deployer).swapExactTokenForPt(gUSDC.target, amount);
            
            // Rescue les tokens
            const ptBalance = await ptgUSDC.balanceOf(mockPendleRouter.target);
            await mockPendleRouter.connect(deployer).rescuePT(ptgUSDC.target, ptBalance);
            expect(await ptgUSDC.balanceOf(deployer.address)).to.be.gt(0);
        });

        it("Should allow owner to rescue underlying tokens", async function () {
            const { mockPendleRouter, deployer, gUSDC } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);

            // Transfer some tokens to the router
            await gUSDC.transfer(mockPendleRouter.target, amount);
            
            // Rescue the tokens
            await mockPendleRouter.connect(deployer).rescueToken(gUSDC.target, amount);
            expect(await gUSDC.balanceOf(deployer.address)).to.be.gt(0);
        });

        it("Should revert if non-owner tries to rescue PT tokens", async function () {
            const { mockPendleRouter, user1, ptgUSDC } = await loadFixture(deployMockPendleRouterFixture);
            await expect(
                mockPendleRouter.connect(user1).rescuePT(ptgUSDC.target, 100)
            ).to.be.revertedWithCustomError(mockPendleRouter, "OwnableUnauthorizedAccount");
        });

        it("Should revert if non-owner tries to rescue underlying tokens", async function () {
            const { mockPendleRouter, user1, gUSDC } = await loadFixture(deployMockPendleRouterFixture);
            await expect(
                mockPendleRouter.connect(user1).rescueToken(gUSDC.target, 100)
            ).to.be.revertedWithCustomError(mockPendleRouter, "OwnableUnauthorizedAccount");
        });
    });

    // ::::::::::::: STRATEGY DETAILS TESTS ::::::::::::: //
    describe("Strategy Details", function () {
        it("Should return correct strategy details", async function () {
            const { mockPendleRouter, gUSDC, ptgUSDC, mockPendleOracle, user1 } = await loadFixture(deployMockPendleRouterFixture);
            const amount = ethers.parseUnits("100", 6);

            // Setup a strategy
            await gUSDC.transfer(user1.address, amount);
            await gUSDC.connect(user1).approve(mockPendleRouter.target, amount);

            // Faire le swap
            const tx = await mockPendleRouter.connect(user1).swapExactTokenForPt(gUSDC.target, amount);
            const receipt = await tx.wait();

            // Récupérer la date de maturité depuis l'événement Swapped
            const swapEvent = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'Swapped'
            );
            const maturityDate = swapEvent.args.maturityDate;

            // Vérifier les détails de la stratégie
            const strategy = await mockPendleRouter.getActiveStrategy(user1.address, maturityDate);
            expect(strategy.amount).to.be.gt(0);
            expect(strategy.annualYield).to.equal(10); // 10% comme défini dans le fixture
            expect(strategy.duration).to.equal(180); // 180 jours comme défini dans le fixture
            expect(strategy.entryRate).to.be.gt(0);
        });
    });
});