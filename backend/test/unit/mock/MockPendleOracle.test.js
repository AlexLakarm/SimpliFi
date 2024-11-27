const { assert, expect } = require("chai"); 
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MockPendleOracle Contract Tests", function () {

    // ::::::::::::: FIXTURES ::::::::::::: //  
    async function deployMockPendleOracleFixture() {
        const [deployer, user1, user2] = await ethers.getSigners();
        
        // Déployer le contrat MockPendleOracle
        const mockPendleOracle = await hre.ethers.deployContract("MockPendleOracle");
        await mockPendleOracle.waitForDeployment();

        return { deployer, user1, user2, mockPendleOracle };
    }

    async function deployAndInitializeStrategyFixture() {
        const { deployer, user1, user2, mockPendleOracle } = await loadFixture(deployMockPendleOracleFixture);

        // Déployer le contrat PtgUSDC
        const PtgUSDC = await hre.ethers.getContractFactory("PtgUSDC");
        const ptgUSDC = await PtgUSDC.deploy();
        await ptgUSDC.waitForDeployment();

        // Initialiser la durée (180 jours en secondes)
        const duration = 180 * 24 * 60 * 60;
        await mockPendleOracle.setDuration(ptgUSDC.target, duration);

        // Initialiser le taux annuel (10%)
        const annualYieldPoints = 10; // Exprimé ici en point directement soit 10;
        await mockPendleOracle.setRateAndPrice(ptgUSDC.target, annualYieldPoints);

        return { 
            deployer, 
            user1, 
            user2, 
            mockPendleOracle,
            ptgUSDC,
            duration,
            annualYieldPoints
        };
    }

    // ::::::::::::: DEPLOYMENT TESTS ::::::::::::: //
    describe("Deployment", function () {
        it("Should set deployer as owner", async function () {
            const { mockPendleOracle, deployer } = await loadFixture(deployMockPendleOracleFixture);
            expect(await mockPendleOracle.owner()).to.equal(deployer.address);
        });
    });

    // ::::::::::::: STRATEGY INITIALIZATION TESTS ::::::::::::: //
    describe("Strategy Initialization", function () {
        it("Should set correct duration", async function () {
            const { mockPendleOracle, ptgUSDC, duration } = await loadFixture(deployAndInitializeStrategyFixture);
            expect(await mockPendleOracle.getDuration(ptgUSDC.target)).to.equal(duration);
        });

        it("Should set correct yield rate", async function () {
            const { mockPendleOracle, ptgUSDC, annualYieldPoints } = await loadFixture(deployAndInitializeStrategyFixture);
            expect(await mockPendleOracle.getYield(ptgUSDC.target)).to.equal(annualYieldPoints);
        });

        it("Should revert if non-owner tries to set duration", async function () {
            const { mockPendleOracle, user1, ptgUSDC } = await loadFixture(deployAndInitializeStrategyFixture);
            await expect(mockPendleOracle.connect(user1).setDuration(ptgUSDC.target, 1000))
                .to.be.revertedWithCustomError(mockPendleOracle, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });

        it("Should revert if non-owner tries to set yield rate", async function () {
            const { mockPendleOracle, user1, ptgUSDC } = await loadFixture(deployAndInitializeStrategyFixture);
            await expect(mockPendleOracle.connect(user1).setRateAndPrice(ptgUSDC.target, 2000))
                .to.be.revertedWithCustomError(mockPendleOracle, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });
    });

    // ::::::::::::: GETTERS TESTS ::::::::::::: //
    describe("Getters", function () {
        describe("getPTRate", function () {
            it("Should return correct PT rate", async function () {
                const { mockPendleOracle, ptgUSDC } = await loadFixture(deployAndInitializeStrategyFixture);
                const rate = await mockPendleOracle.getPTRate(ptgUSDC.target);
                expect(rate).to.not.equal(0);
            });

            it("Should revert for non-initialized token", async function () {
                const { mockPendleOracle } = await loadFixture(deployAndInitializeStrategyFixture);
                await expect(mockPendleOracle.getPTRate(ethers.ZeroAddress))
                    .to.be.revertedWith("Rate not set for this token");
            });
        });

        describe("getYield", function () {
            it("Should return correct yield", async function () {
                const { mockPendleOracle, ptgUSDC, annualYieldPoints } = await loadFixture(deployAndInitializeStrategyFixture);
                const yield_ = await mockPendleOracle.getYield(ptgUSDC.target);
                expect(yield_).to.equal(annualYieldPoints);
            });

            it("Should revert for non-initialized token", async function () {
                const { mockPendleOracle } = await loadFixture(deployAndInitializeStrategyFixture);
                await expect(mockPendleOracle.getYield(ethers.ZeroAddress))
                    .to.be.revertedWith("Yield not set for this token");
            });
        });

        describe("getDuration", function () {
            it("Should return correct duration", async function () {
                const { mockPendleOracle, ptgUSDC, duration } = await loadFixture(deployAndInitializeStrategyFixture);
                const tokenDuration = await mockPendleOracle.getDuration(ptgUSDC.target);
                expect(tokenDuration).to.equal(duration);
            });

            it("Should revert for non-initialized token", async function () {
                const { mockPendleOracle } = await loadFixture(deployAndInitializeStrategyFixture);
                await expect(mockPendleOracle.getDuration(ethers.ZeroAddress))
                    .to.be.revertedWith("Duration not set for this token");
            });
        });

        describe("Multiple tokens", function () {
            it("Should handle different values for different tokens", async function () {
                const { mockPendleOracle, ptgUSDC, deployer } = await loadFixture(deployAndInitializeStrategyFixture);
                
                // Déployer un second token PT
                const PtgUSDC2 = await hre.ethers.getContractFactory("PtgUSDC");
                const ptgUSDC2 = await PtgUSDC2.deploy();
                await ptgUSDC2.waitForDeployment();

                // Configurer des valeurs différentes pour le second token
                const duration2 = 90 * 24 * 60 * 60; // 90 jours
                const annualYieldPoints2 = 20; // Exprimé ici en point directement soit 20;
                await mockPendleOracle.setDuration(ptgUSDC2.target, duration2);
                await mockPendleOracle.setRateAndPrice(ptgUSDC2.target, annualYieldPoints2);

                // Vérifier que chaque token a ses propres valeurs
                expect(await mockPendleOracle.getYield(ptgUSDC2.target)).to.equal(annualYieldPoints2);
                expect(await mockPendleOracle.getDuration(ptgUSDC2.target)).to.equal(duration2);
                
                // Vérifier que le premier token conserve ses valeurs originales
                const { duration, annualYieldPoints } = await loadFixture(deployAndInitializeStrategyFixture);
                expect(await mockPendleOracle.getYield(ptgUSDC.target)).to.equal(annualYieldPoints);
                expect(await mockPendleOracle.getDuration(ptgUSDC.target)).to.equal(duration);
            });
        });
    });

    // ::::::::::::: SET TEST PARAMETERS TESTS ::::::::::::: //
    describe("setTestParameters", function () {
        it("Should allow owner to set test parameters", async function () {
            const { mockPendleOracle, deployer, ptgUSDC } = await loadFixture(deployAndInitializeStrategyFixture);
            
            await mockPendleOracle.connect(deployer).setTestParameters(ptgUSDC.target);

            // Vérifier que la durée est de 1 minute
            expect(await mockPendleOracle.getDuration(ptgUSDC.target)).to.equal(60); // 1 minute en secondes

            // Vérifier que le yield est de 50%
            expect(await mockPendleOracle.getYield(ptgUSDC.target)).to.equal(50);
        });

        it("Should revert if non-owner tries to set test parameters", async function () {
            const { mockPendleOracle, user1, ptgUSDC } = await loadFixture(deployAndInitializeStrategyFixture);
            
            await expect(mockPendleOracle.connect(user1).setTestParameters(ptgUSDC.target))
                .to.be.revertedWithCustomError(mockPendleOracle, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });

        it("Should emit all relevant events", async function () {
            const { mockPendleOracle, deployer, ptgUSDC } = await loadFixture(deployAndInitializeStrategyFixture);
            
            const tx = await mockPendleOracle.connect(deployer).setTestParameters(ptgUSDC.target);
            
            await expect(tx)
                .to.emit(mockPendleOracle, "DurationUpdated")
                .withArgs(ptgUSDC.target, 60); // 1 minute

            await expect(tx)
                .to.emit(mockPendleOracle, "YieldUpdated")
                .withArgs(ptgUSDC.target, 50); // 50%

            await expect(tx)
                .to.emit(mockPendleOracle, "RateUpdated");
        });
    });
});