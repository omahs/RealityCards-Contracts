const { assert } = require("hardhat");
const { BN, expectRevert, ether, expectEvent, balance, time } = require("@openzeppelin/test-helpers");

// main contracts
var RCFactory = artifacts.require("./RCFactory.sol");
var RCTreasury = artifacts.require("./RCTreasury.sol");
var RCMarket = artifacts.require("./RCMarket.sol");
var NftHubXDai = artifacts.require("./nfthubs/RCNftHubXdai.sol");
var NftHubMainnet = artifacts.require("./nfthubs/RCNftHubMainnet.sol");
var XdaiProxy = artifacts.require("./bridgeproxies/RCProxyXdai.sol");
var MainnetProxy = artifacts.require("./bridgeproxies/RCProxyMainnet.sol");
// mockups
var RealitioMockup = artifacts.require("./mockups/RealitioMockup.sol");
var BridgeMockup = artifacts.require("./mockups/BridgeMockup.sol");
var AlternateReceiverBridgeMockup = artifacts.require("./mockups/AlternateReceiverBridgeMockup.sol");
var SelfDestructMockup = artifacts.require("./mockups/SelfDestructMockup.sol");
var DaiMockup = artifacts.require("./mockups/DaiMockup.sol");
var markets = [];
var kleros = "0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D";

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

contract("TestTreasury", (accounts) => {
    var maxuint256 = 4294967295;

    user0 = accounts[0]; //0xc783df8a850f42e7F7e57013759C285caa701eB6
    user1 = accounts[1]; //0xeAD9C93b79Ae7C1591b1FB5323BD777E86e150d4
    user2 = accounts[2]; //0xE5904695748fe4A84b40b3fc79De2277660BD1D3
    user3 = accounts[3]; //0x92561F28Ec438Ee9831D00D1D59fbDC981b762b2
    user4 = accounts[4];
    user5 = accounts[5];
    user6 = accounts[6];
    user7 = accounts[7];
    user8 = accounts[8];
    user9 = accounts[9];
    // throws a tantrum if cardRecipients is not outside beforeEach for some reason
    var zeroAddress = "0x0000000000000000000000000000000000000000";

    beforeEach(async () => {
        // main contracts
        treasury = await RCTreasury.new();
        rcfactory = await RCFactory.new(treasury.address);
        rcreference = await RCMarket.new();
        // nft hubs
        nfthubxdai = await NftHubXDai.new(rcfactory.address);
        nfthubmainnet = await NftHubMainnet.new();
        // tell treasury about factory, tell factory about nft hub and reference
        await treasury.setFactoryAddress(rcfactory.address);
        await rcfactory.setReferenceContractAddress(rcreference.address);
        await rcfactory.setNftHubAddress(nfthubxdai.address, 0);
        // mockups
        realitio = await RealitioMockup.new();
        bridge = await BridgeMockup.new();
        alternateReceiverBridge = await AlternateReceiverBridgeMockup.new();
        dai = await DaiMockup.new();
        // bridge contracts
        xdaiproxy = await XdaiProxy.new(bridge.address, rcfactory.address, treasury.address, realitio.address, realitio.address);
        mainnetproxy = await MainnetProxy.new(bridge.address, nfthubmainnet.address, alternateReceiverBridge.address, dai.address);
        // tell the factory, mainnet proxy and bridge the xdai proxy address
        await rcfactory.setProxyXdaiAddress(xdaiproxy.address);
        await mainnetproxy.setProxyXdaiAddress(xdaiproxy.address);
        await bridge.setProxyXdaiAddress(xdaiproxy.address);
        // tell the xdai proxy, nft mainnet hub and bridge the mainnet proxy address
        await xdaiproxy.setProxyMainnetAddress(mainnetproxy.address);
        await bridge.setProxyMainnetAddress(mainnetproxy.address);
        await nfthubmainnet.setProxyMainnetAddress(mainnetproxy.address);
        // tell the treasury about the ARB
        await treasury.setAlternateReceiverAddress(alternateReceiverBridge.address);
        // market creation
        await createMarket();
    });

    afterEach(async () => {
        // withdraw all users
        await time.increase(time.duration.minutes(10));
        for (i = 0; i < 10; i++) {
            user = eval("user" + i);
            if ((await treasury.userDeposit.call(user)) != "0") {
                await treasury.withdrawDeposit(web3.utils.toWei("10000", "ether"), { from: user });
            }
        }
        await time.increase(time.duration.minutes(10));
    });

    async function createMarket(mode, openTime, closeTime, resolveTime, numberOfCards, artistAddress, affiliateAddress, cardAffiliate) {
        // default values if no parameter passed
        if (typeof mode === "undefined") mode = 0;
        if (typeof openTime === "undefined") openTime = 0;
        if (typeof closeTime === "undefined") closeTime = new BN("31536000").add(await time.latest());
        if (typeof resolveTime === "undefined") resolveTime = new BN("31536000").add(await time.latest());
        if (typeof numberOfCards === "undefined") numberOfCards = 4;
        if (typeof artistAddress === "undefined") artistAddress = zeroAddress;
        if (typeof affiliateAddress === "undefined") affiliateAddress = zeroAddress;
        if (typeof cardAffiliate === "undefined") cardAffiliate = [zeroAddress];
        var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
        // assemble arrays
        var timestamps = [openTime, closeTime, resolveTime];
        var tokenURIs = [];
        for (i = 1; i < numberOfCards; i++) {
            tokenURIs.push("x");
        }

        await rcfactory.createMarket(mode, "0x0", timestamps, tokenURIs, artistAddress, affiliateAddress, cardAffiliate, question);
        markets.push(await rcfactory.getMostRecentMarket.call(0));
    }

    async function depositDai(amount, user) {
        amount = web3.utils.toWei(amount.toString(), "ether");
        await treasury.deposit(user, { from: user, value: amount });
    }

    async function newRental(price, outcome, user) {
        price = web3.utils.toWei(price.toString(), "ether");
        var tempMarket = await RCMarket.at(markets[0]);
        await tempMarket.newRental(price, 0, zeroAddress, outcome, { from: user });
    }

    async function newRentalWithStartingPosition(price, outcome, position, user) {
        price = web3.utils.toWei(price.toString(), "ether");
        await realitycards.newRental(price, 0, position, outcome, { from: user });
    }

    async function newRentalWithDeposit(price, outcome, user, dai) {
        price = web3.utils.toWei(price.toString(), "ether");
        dai = web3.utils.toWei(dai.toString(), "ether");
        await realitycards.newRental(price, 0, zeroAddress, outcome, { from: user, value: dai });
    }

    async function newRentalCustomContract(contract, price, outcome, user) {
        price = web3.utils.toWei(price.toString(), "ether");
        await contract.newRental(price, maxuint256.toString(), zeroAddress, outcome, { from: user });
    }

    async function newRentalWithDepositCustomContract(contract, price, outcome, user, dai) {
        price = web3.utils.toWei(price.toString(), "ether");
        dai = web3.utils.toWei(dai.toString(), "ether");
        await contract.newRental(price, maxuint256.toString(), zeroAddress, outcome, { from: user, value: dai });
    }

    async function newRentalCustomTimeLimit(price, timelimit, outcome, user) {
        price = web3.utils.toWei(price.toString(), "ether");
        await realitycards.newRental(price, (timelimit * 3600 * 24).toString(), zeroAddress, outcome, { from: user });
    }

    async function userRemainingDeposit(outcome, userx) {
        await realitycards.userRemainingDeposit.call(outcome, { from: userx });
    }

    async function withdraw(userx) {
        await realitycards.withdraw({ from: userx });
    }

    async function withdrawDeposit(amount, userx) {
        amount = web3.utils.toWei(amount.toString(), "ether");
        await treasury.withdrawDeposit(amount, { from: userx });
    }

    it.skip("Ensure only factory can add markets", async () => {
        // Factory create a market
        var nextMarket = markets.length;
        // Assert this market doesn't exist yet
        assert.equal(typeof markets[nextMarket] === "undefined", true);
        await createMarket();
        // Assert this market now exists
        assert.equal(typeof markets[nextMarket] === "undefined", false);
        // Non-factory try and add a market
        await expectRevert(treasury.addMarket(user3), "Not factory");
    });

    it.skip("check that non markets cannot call market only functions on Treasury", async () => {
        // only testing invalid responses, valid responses checked in each functions own test
        await expectRevert(treasury.payRent(user0, user0), "Not authorised");
        await expectRevert(treasury.payout(user0, 0), "Not authorised");
        await expectRevert(treasury.sponsor(), "Not authorised");
        await expectRevert(treasury.processHarbergerPayment(user0, user0, 0), "Not authorised");
        await expectRevert(treasury.updateLastRentalTime(user0), "Not authorised");
        await expectRevert(treasury.updateUserBid(user0, 0, 0), "Not authorised");
        await expectRevert(treasury.updateMarketStatus(true), "Not authorised");
    });

    it.skip("check that non owners cannot call owner only functions on Treasury", async () => {
        // only testing invalid responses, valid responses checked in each functions own test
        await expectRevert(treasury.setMinRental(10, { from: user1 }), "Ownable: caller is not the owner");
        await expectRevert(treasury.setMaxContractBalance(10, { from: user1 }), "Ownable: caller is not the owner");
        await expectRevert(treasury.setMaxBidLimit(10, { from: user1 }), "Ownable: caller is not the owner");
        await expectRevert(treasury.setAlternateReceiverAddress(zeroAddress, { from: user1 }), "Ownable: caller is not the owner");
        await expectRevert(treasury.changeGlobalPause({ from: user1 }), "Ownable: caller is not the owner");
        await expectRevert(treasury.changePauseMarket(zeroAddress, { from: user1 }), "Ownable: caller is not the owner");
    });

    it.skip("test setMinRental", async () => {
        // set value
        await treasury.setMinRental(24);
        // check value
        assert.equal(await treasury.minRentalDayDivisor(), 24);
        // change the value (it might already have been 24)
        await treasury.setMinRental(48);
        // check again
        assert.equal(await treasury.minRentalDayDivisor(), 48);
    });

    it.skip("test setMaxContractBalance function and deposit limit hit", async () => {
        // change deposit balance limit to 500 ether
        await treasury.setMaxContractBalance(web3.utils.toWei("500", "ether"));
        // 400 should work
        await depositDai(400, user0);
        // another 400 should not
        await expectRevert(treasury.deposit(user0, { value: web3.utils.toWei("500", "ether") }), "Limit hit");
    });

    it("test setMaxBidLimit", async () => {
        // set value
        await treasury.setMaxBidLimit(20);
        // check value
        assert.equal(await treasury.maxBidCountLimit(), 20);
        // change the value (it might already have been 20)
        await treasury.setMaxBidLimit(35);
        // check again
        assert.equal(await treasury.maxBidCountLimit(), 35);
    });

    it("test setAlternateReciverAddress", async () => {
        // check for zero address
        await expectRevert(treasury.setAlternateReceiverAddress(zeroAddress), "Must set an address");
        // set value
        await treasury.setAlternateReceiverAddress(user9);
        // check value
        assert.equal(await treasury.alternateReceiverBridgeAddress(), user9);
        // change the value
        await treasury.setAlternateReceiverAddress(user8);
        // check again
        assert.equal(await treasury.alternateReceiverBridgeAddress(), user8);
    });

    it("test changeGlobalPause", async () => {
        var globalPauseState = await treasury.globalPause();
        // change value
        await treasury.changeGlobalPause();
        // check value
        assert.equal(await treasury.globalPause(), !globalPauseState);
        // change it back
        await treasury.changeGlobalPause();
        // check again
        assert.equal(await treasury.globalPause(), globalPauseState);
    });

    it.skip("test changePauseMarket", async () => {
        // we don't check for zero address or even that it's actaully a market
        var pauseMarketState = await treasury.marketPaused(zeroAddress);
        // change value
        await treasury.changePauseMarket(zeroAddress);
        // check value
        assert.equal(await treasury.marketPaused(zeroAddress), !pauseMarketState);
        // change it back
        await treasury.changePauseMarket(zeroAddress);
        // check again
        assert.equal(await treasury.marketPaused(zeroAddress), pauseMarketState);
    });

    it("check cant rent or deposit if globalpause", async () => {
        // setup
        var temp = await treasury.minRentalDayDivisor();
        console.log(temp.toString());
        await depositDai(100, user0);
        await newRental(14, 0, user0);
        await treasury.changeGlobalPause();
        await expectRevert(depositDai(144, user0), "Deposits are disabled");
        await expectRevert(newRental(144, 0, user1), "Rentals are disabled");
        // change it back to withdraw again
        await treasury.changeGlobalPause();
    });

    it("check cant rent if market paused", async () => {
        // setup
        await treasury.changePauseMarket(realitycards.address);
        depositDai(144, user0);
        await expectRevert(newRental(144, 0, user0), "Rentals are disabled");
        await time.increase(time.duration.minutes(10));
        await withdrawDeposit(1000, user0);
    });

    it("test force sending Ether to Treasury via self destruct", async () => {
        selfdestruct = await SelfDestructMockup.new();
        // send ether direct to self destruct contract
        await selfdestruct.send(web3.utils.toWei("1000", "ether"));
        await selfdestruct.killme(treasury.address);
        // do a regs deposit
        await depositDai(100, user6);
    });

    it("test updateUserBids", async () => {
        await depositDai(10, user0);
        await depositDai(100, user1);
        await depositDai(10, user2);
        await depositDai(10, user3);
        // make a rental, check it updates the userBids
        await newRental(5, 0, user0);
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("5").toString());
        // make another rental and check again
        await newRental(3, 1, user0);
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("8").toString());
        // different market this time
        var realitycards2 = await createMarketWithArtistSet();
        await newRentalCustomContract(realitycards2, 1, 7, user0);
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("9").toString());
        // increase bid, still correct? user0=10
        await newRental(6, 0, user0);
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("10").toString());
        // decrease bid, still correct? user0=8
        await newRental(4, 0, user0);
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("8").toString());
        // someone else takes it off them, are both correct? user0=8 user1=7
        await newRental(7, 0, user1);
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("8").toString());
        var totalRentals = await treasury.userTotalBids(user1);
        assert.equal(totalRentals.toString(), ether("7").toString());
        // change tokenPrice, check both are correct user0=11.5 user1=7
        await newRental(7.5, 0, user0);
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("11.5").toString());
        var totalRentals = await treasury.userTotalBids(user1);
        assert.equal(totalRentals.toString(), ether("7").toString());
        // new user exits, still correct? user0=11.5 user1=0
        await markets[0].exit(0, { from: user1 });
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("11.5").toString());
        var totalRentals = await treasury.userTotalBids(user1);
        assert.equal(totalRentals.toString(), ether("0").toString());
        // this user exits, still correct?
        await realitycards.exit(0, { from: user0 });
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("4").toString());
        // increase rent to 1439 (max 1440) then rent again, check it fails
        await newRental(1435, 0, user0);
        await expectRevert(newRental(5, 3, user0), " Insufficient deposit");
        // someone bids even higher, I increase my bid above what I can afford, we all run out of deposit, should not return to me
        await newRental(2000, 0, user1);
        await time.increase(time.duration.weeks(1));
        await markets[0].collectRentAllCards();
        // check owned by contract
        var owner = await realitycards.ownerOf.call(0);
        assert.equal(owner, realitycards.address);
    });

    it("test withdraw deposit after market close", async () => {
        user = user0;
        // create a market that'll expire soon

        await depositDai(100, user);
        await shortMarket.newRental(web3.utils.toWei("1", "ether"), 0, zeroAddress, 0, { from: user });
        await time.increase(time.duration.seconds(86400));
        await shortMarket.collectRentAllCards();
        await shortMarket.lockMarket();
        await treasury.withdrawDeposit(web3.utils.toWei("100000", "ether"), { from: user });
    });

    it("check bids are exited when user withdraws everything", async () => {
        await depositDai(100, user0);
        await newRental(5, 0, user0);
        await time.increase(time.duration.days(1));
        await treasury.withdrawDeposit(web3.utils.toWei("5", "ether"), { from: user0 });
        var totalRentals = await treasury.userTotalBids(user0);
        assert.equal(totalRentals.toString(), ether("5").toString());

        await treasury.withdrawDeposit(web3.utils.toWei("1000", "ether"), { from: user0 });
        var owner = await realitycards.ownerOf.call(0);
        assert.notEqual(owner, user0);
    });
});
