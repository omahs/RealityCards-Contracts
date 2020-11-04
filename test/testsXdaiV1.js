const { assert } = require('hardhat');
const {
  BN,
  shouldFail,
  ether,
  expectEvent,
  balance,
  time
} = require('openzeppelin-test-helpers');

var RCFactory = artifacts.require('./RCFactory.sol');
var RCTreasury = artifacts.require('./RCTreasury.sol');
var RCMarket = artifacts.require('./RCMarketXdaiV1.sol');
var RealitioMockup = artifacts.require("./mockups/RealitioMockup.sol");

const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

contract('RealityCardsTests XdaiV1', (accounts) => {

  var realitycards;
  var tokenURIs = ['x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x']; // 20 tokens
  var tokenNAme = 'RCToken'; 
  var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
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
  andrewsAddress = accounts[9];

  beforeEach(async () => {
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture; 
    var oracleResolutionTime = oneYearInTheFuture; 
    var timestamps = [0,marketLockingTime,oracleResolutionTime];
    realitio = await RealitioMockup.new();
    treasury = await RCTreasury.new();
    rcreference = await RCMarket.new();
    rcfactory = await RCFactory.new(treasury.address, realitio.address);
    await rcfactory.setReferenceContractAddress(0,rcreference.address);
    await rcfactory.createMarket(
        0,
        '0x0',
        timestamps,
        tokenURIs,
        question,
        tokenNAme,
      );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards = await RCMarket.at(marketAddress);
  });

  async function createMarket() {
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture; 
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0,marketLockingTime,oracleResolutionTime];
    await rcfactory.createMarket(
        0,
        '0x0',
        timestamps,
        tokenURIs,
        question,
        tokenNAme,
      );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function createMarketMode1() {
    var latestTime = await time.latest();
    var oneYear = new BN('31104000');
    var oneYearInTheFuture = oneYear.add(latestTime);
    var marketLockingTime = oneYearInTheFuture; 
    var oracleResolutionTime = oneYearInTheFuture;
    var timestamps = [0,marketLockingTime,oracleResolutionTime];
    await rcfactory.createMarket(
        1,
        '0x0',
        timestamps,
        tokenURIs,
        question,
        tokenNAme,
      );
    var marketAddress = await rcfactory.getMostRecentMarket.call(1);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function createMarketCustomeTimestamps(marketOpeningTime,marketLockingTime,oracleResolutionTime) {
    var timestamps = [marketOpeningTime,marketLockingTime,oracleResolutionTime];
    await rcfactory.createMarket(
        0,
        '0x0',
        timestamps,
        tokenURIs,
        question,
        tokenNAme,
      );
    var marketAddress = await rcfactory.getMostRecentMarket.call(0);
    realitycards2 = await RCMarket.at(marketAddress);
    return realitycards2;
  }

  async function depositDai(amount, user) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    await treasury.deposit(user,{ from: user, value: amount });
  }

  async function newRental(price, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await realitycards.newRental(price,0,outcome,{ from: user});
  }

  async function newRentalWithDeposit(price, outcome, user, dai) {
    price = web3.utils.toWei(price.toString(), 'ether');
    dai = web3.utils.toWei(dai.toString(), 'ether');
    await realitycards.newRental(price,0,outcome,{ from: user, value: dai});
  }

  async function newRentalCustomContract(contract, price, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await contract.newRental(price,maxuint256.toString(),outcome,{ from: user});
  }

  async function newRentalCustomTimeLimit(price, timelimit, outcome, user) {
    price = web3.utils.toWei(price.toString(), 'ether');
    await realitycards.newRental(price,(timelimit*3600*24).toString(),outcome,{ from: user});
  }

  async function changePrice(price, outcome, userx) {
    await realitycards.changePrice(price,outcome,{ from: userx });
  }

  async function userRemainingDeposit(outcome, userx) {
    await realitycards.userRemainingDeposit.call(outcome, {from: userx} );
  }

  async function withdraw(userx) {
    await realitycards.withdraw({from:userx} );
  }

  async function withdrawDeposit(amount,userx) {
    amount = web3.utils.toWei(amount.toString(), 'ether');
    await treasury.withdrawDeposit(amount,{ from: userx});
  }

    // check that the contract initially owns the token
    it('getOwner', async () => {
    var i;
    for (i = 0; i < 20; i++) {
        var owner = await realitycards.ownerOf.call(i);
        assert.equal(owner, realitycards.address);
    }
    });

  // check name
  it('getName', async () => {
    var name = await realitycards.name.call();
    assert.equal(name, 'RCToken');
  });

    // check fundamentals first
  it('user 0 rent Token first time and check: price, deposits, owner etc', async () => {
    user = user0;
    // setup
    await depositDai(144,user);
    await newRental(144,4,user);
    // tests
    var price = await realitycards.price.call(4);
    assert.equal(price, web3.utils.toWei('144', 'ether'));
    var deposit = await treasury.deposits.call(user);
    assert.equal(deposit, web3.utils.toWei('143', 'ether'));
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user,4);
    assert.equal(depositSpecific, web3.utils.toWei('1', 'ether'));
    var owner = await realitycards.ownerOf.call(4);
    assert.equal(owner, user);
    // 1 because nothing stored in zero
    var ownerTracker = await realitycards.ownerTracker.call(4, 1);
    assert.equal(ownerTracker[1].toString(), web3.utils.toWei('144', 'ether').toString());
    assert.equal(ownerTracker[0], user);
    // withdraw
    await withdrawDeposit(1000,user);
   });
  
  it('test change price by renting again', async () => {
    user = user0;
    // setup
    await depositDai(10,user);
    await newRental(1,4,user);
    // tests
    var price = await realitycards.price.call(4);
    assert.equal(price, web3.utils.toWei('1', 'ether'));
    // rent again
    await newRental(3,4,user);
    var price = await realitycards.price.call(4);
    assert.equal(price, web3.utils.toWei('3', 'ether'));
    // withdraw
    await withdrawDeposit(1000,user);
   });
  
it('test various after collectRent', async () => {
    // setup
    user = user0;
    await depositDai(100,user);
    await newRental(1,4,user);
    await time.increase(time.duration.weeks(1));
    await realitycards.collectRentAllTokens();
    // tests
    //test deposits
    var deposit = await treasury.deposits.call(user); 
    var depositShouldBe = web3.utils.toWei('93', 'ether');
    var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
    assert.isBelow(difference/deposit,0.00001);
    //test totalCollected. 
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('7', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/deposit,0.00001);
    //test timeLastCollected
    var timeLastCollected = await realitycards.timeLastCollected.call(4);
    currentTime = await time.latest();
    assert.equal(currentTime.toString(),timeLastCollected.toString());
    //wait a week and repeat the above
    await time.increase(time.duration.weeks(1));
    await realitycards.collectRentAllTokens();
    //test deposits
    var deposit = await treasury.deposits.call(user); 
    var depositShouldBe = web3.utils.toWei('86', 'ether');
    var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
    assert.isBelow(difference/deposit,0.00001);
    //test totalCollected. 
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('14', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.001);
    //test timeLastCollected
    var timeLastCollected = await realitycards.timeLastCollected.call(4);
    currentTime = await time.latest();
    assert.equal(currentTime.toString(),timeLastCollected.toString());
    // withdraw
    await withdrawDeposit(1000,user);
});

// test collectRent again, but this time it should foreclose, does it?
it('ccollectRent function with foreclose and revertPreviousOwner', async () => {
    // setup
    await depositDai(6,user0);
    await newRental(1,1,user0);
    await depositDai(10,user1);
    await newRental(2,1,user1);
    await time.increase(time.duration.weeks(1));
    await realitycards.collectRentAllTokens();
    // check reverted
    var owner = await realitycards.ownerOf.call(1);
    assert.equal(owner, user0);
    var price = await realitycards.price.call(1);
    assert.equal(price, web3.utils.toWei('1', 'ether'));
    await time.increase(time.duration.weeks(1));
    await realitycards.collectRentAllTokens();
    var owner = await realitycards.ownerOf.call(1);
    assert.equal(owner, realitycards.address);
    var price = await realitycards.price.call(1);
    assert.equal(price, 0);
});
  
// these are two crucial variables that are relied on for other functions. are they what they should be?
it('test timeHeld and totalTimeHeld', async () => {
    await depositDai(10,user0);
    await newRental(1,0,user0);
    await depositDai(10,user1);
    await newRental(2,0,user1);
    await depositDai(12,user2);
    await newRental(3,0,user2);
    //tests
    await time.increase(time.duration.days(3));
    await realitycards.collectRentAllTokens();
    // u2 3 days
    var timeHeld = await realitycards.timeHeld.call(0, user2);
    var timeHeldShouldBe = time.duration.days(3);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference,4);
    await time.increase(time.duration.days(3));
    await realitycards.collectRentAllTokens();
    // u2 one more day
    var timeHeld = await realitycards.timeHeld.call(0, user2);
    var timeHeldShouldBe = time.duration.days(4);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference,2);
    await time.increase(time.duration.days(3));
    await realitycards.collectRentAllTokens();
    // u2 still 4 days, u1 5 days, u0 0 days
    var timeHeld = await realitycards.timeHeld.call(0, user2);
    var timeHeldShouldBe = time.duration.days(4);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,2);
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.days(5);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    await time.increase(time.duration.days(3));
    await realitycards.collectRentAllTokens();
    // u1 5 days, u0 3 days
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.days(5);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    var timeHeld = await realitycards.timeHeld.call(0, user0);
    var timeHeldShouldBe = time.duration.days(3);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    await time.increase(time.duration.days(1));
    await realitycards.collectRentAllTokens();
    // u1 5 days, u0 6 day
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.days(5);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    var timeHeld = await realitycards.timeHeld.call(0, user0);
    var timeHeldShouldBe = time.duration.days(4);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    // buy again, check the new owner, then revert again
    user = user5;
    await depositDai(10,user5);
    await newRental(10,0,user5);
    await time.increase(time.duration.days(2));
    await realitycards.collectRentAllTokens();
    var timeHeld = await realitycards.timeHeld.call(0, user5);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    await time.increase(time.duration.days(7));
    await realitycards.collectRentAllTokens();
    // u0 8 days
    var timeHeld = await realitycards.timeHeld.call(0, user0);
    var timeHeldShouldBe = time.duration.days(10);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    await time.increase(time.duration.days(9));
    await realitycards.collectRentAllTokens();
    // u0 10 days
    var timeHeld = await realitycards.timeHeld.call(0, user0);
    var timeHeldShouldBe = time.duration.days(10);
    var difference = Math.abs(timeHeld - timeHeldShouldBe); 
    assert.isBelow(difference/timeHeld,0.001);
    // check total collected
    var totalTimeHeldShouldBe = time.duration.days(20);
    var totalTimeHeld = await realitycards.totalTimeHeld.call(0);
    var difference = Math.abs(totalTimeHeld - totalTimeHeldShouldBe);
    assert.isBelow(difference/timeHeld,0.001);
});
  
it('test withdrawDeposit after zero mins', async () => {
    user = user0;
    await depositDai(144,user);
    await newRental(144,0,user);
    var deposit = await treasury.deposits.call(user); 
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user,0);
    assert.equal(deposit, web3.utils.toWei('143', 'ether')); 
    assert.equal(depositSpecific, web3.utils.toWei('1', 'ether')); 
    // withdraw half
    var balanceBefore = await web3.eth.getBalance(user);
    await withdrawDeposit(72,user);
    // check deposit balances 
    var deposit = await treasury.deposits.call(user); 
    var depositShouldBe = web3.utils.toWei('71', 'ether');
    var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
    assert.isBelow(difference/deposit,0.00001);
    // check withdrawn amounts
    var balanceAfter = await web3.eth.getBalance(user);
    var depositWithdrawn = await balanceAfter - balanceBefore;
    var depositWithdrawnShouldBe = web3.utils.toWei('72', 'ether');
    var difference = Math.abs(depositWithdrawn.toString()-depositWithdrawnShouldBe.toString());
    assert.isBelow(difference/depositWithdrawnShouldBe,0.00001);
    // withdraw too much, should only allow you to withdraw the remaining
    var balanceBefore = await web3.eth.getBalance(user);
    await withdrawDeposit(100,user);
    // check deposit balances 
    var deposit = await treasury.deposits.call(user); 
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user,0);
    assert.equal(deposit, 0); 
    assert.equal(depositSpecific, web3.utils.toWei('1', 'ether'));
    // check withdrawn amounts 
    var balanceAfter = await web3.eth.getBalance(user);
    var depositWithdrawn = await balanceAfter - balanceBefore;
    var depositWithdrawnShouldBe = web3.utils.toWei('71', 'ether');
    var difference = Math.abs(depositWithdrawn.toString()-depositWithdrawnShouldBe.toString());
    assert.isBelow(difference/depositWithdrawnShouldBe,0.00001);
});

it('test withdrawDeposit- multiple markets', async () => {
    user = user0;
    await depositDai(10,user);
    await newRental(144,0,user);
    //second market
    realitycards2 = await createMarket();
    await realitycards2.newRental(web3.utils.toWei('288', 'ether'),maxuint256,0,{ from: user});
    // withdraw all, should be 3 left therefore only withdraw 7
    var balanceBefore = await web3.eth.getBalance(user);
    await withdrawDeposit(1000,user);
    var balanceAfter = await web3.eth.getBalance(user);
    var depositWithdrawn = await balanceAfter - balanceBefore;
    var depositWithdrawnShouldBe = web3.utils.toWei('7', 'ether');
    var difference = Math.abs(depositWithdrawn.toString() - depositWithdrawnShouldBe.toString());
    assert.isBelow(difference/depositWithdrawn,0.001);
    //original user tries to withdraw again, should be nothign to withdraw 
    await shouldFail.reverting.withMessage(treasury.withdrawDeposit(1000), "Nothing to withdraw");
});

it('test exit- more than ten mins', async () => {
    // setup
    await depositDai(144,user0);
    await depositDai(144,user1);
    await newRental(10,0,user0);
    await newRental(144,0,user1);
    await time.increase(time.duration.hours(1)); 
    await realitycards.collectRentAllTokens();
    // user 1 should still be owner, held for 1 hour
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.hours(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference,5);
    // call exit, user 0 should own and no more time held on u1
    await realitycards.exit(0,{ from: user1  });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    await time.increase(time.duration.hours(1)); 
    await realitycards.collectRentAllTokens();
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.hours(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference,3);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
});

    it('test exit- less than ten mins', async () => {
        // setup
        await depositDai(144,user0);
        await depositDai(144,user1);
        await newRental(10,0,user0);
        await newRental(144,0,user1);
        await time.increase(time.duration.minutes(5)); 
        await realitycards.collectRentAllTokens();
        // user 1 should be owner, held for 5 mins
        var owner = await realitycards.ownerOf.call(0);
        assert.equal(owner, user1);
        var timeHeld = await realitycards.timeHeld.call(0, user1);
        var timeHeldShouldBe = time.duration.minutes(5);
        var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
        assert.isBelow(difference,5);
        // call exit, user 1 should still own
        await realitycards.exit(0,{ from: user1 });
        var owner = await realitycards.ownerOf.call(0);
        assert.equal(owner, user1);
        // increase by an hour, user 0 will own and u1 should have ten minutes ownership time
        await time.increase(time.duration.hours(1)); 
        await realitycards.collectRentAllTokens();
        var owner = await realitycards.ownerOf.call(0);
        assert.equal(owner, user0);
        var timeHeld = await realitycards.timeHeld.call(0, user1);
        var timeHeldShouldBe = time.duration.minutes(10);
        var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
        assert.isBelow(difference/timeHeldShouldBe,0.01);
        // to be safe, chcek that u0 has owned for 55 mins
        await realitycards.collectRentAllTokens();
        var timeHeld = await realitycards.timeHeld.call(0, user0);
        var timeHeldShouldBe = time.duration.minutes(55);
        var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
        assert.isBelow(difference/timeHeldShouldBe,0.01);
        // withdraw for next test
        await withdrawDeposit(1000,user0);
        await withdrawDeposit(1000,user1);
    });

    it('test exitAll', async () => {
        // setup
        await depositDai(144,user0);
        await newRental(10,0,user0);
        await newRental(10,1,user0);
        await newRental(10,2,user0);
        await newRental(10,3,user0);
        await depositDai(144,user1);
        await newRental(144,0,user1);
        await newRental(144,1,user1);
        await newRental(144,2,user1);
        await newRental(144,3,user1);
        await time.increase(time.duration.hours(1)); 
        // exit all, should all be owned by user 0
        await realitycards.exitAll({ from: user1  });
        var owner = await realitycards.ownerOf.call(0);
        assert.equal(owner, user0);
        var owner = await realitycards.ownerOf.call(1);
        assert.equal(owner, user0);
        var owner = await realitycards.ownerOf.call(2);
        assert.equal(owner, user0);
        var owner = await realitycards.ownerOf.call(3);
        assert.equal(owner, user0);
        // withdraw for next test
        await withdrawDeposit(1000,user0);
        await withdrawDeposit(1000,user1);
    });
  
    // test the payout functions work fine, with different winners each time
  it('test winner/withdraw mode 0', async () => {
    /////// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRental(1,0,user0); // collected 28
    await newRental(2,1,user1); // collected 52
    // rent winning team
    await newRental(1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    // winner 1: 
    // totalcollected = 147, 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket(); 
    // // set winner 1
    await realitio.setResult(2);
    await realitycards.determineWinner();
    ////////////////////////
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    // //check user0 winnings
    var depositBefore = await treasury.deposits.call(user0); 
    await withdraw(user0);
    var depositAfter = await treasury.deposits.call(user0); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user0 cant withdraw again
    await shouldFail.reverting.withMessage(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.deposits.call(user1); 
    await withdraw(user1);
    var depositAfter = await treasury.deposits.call(user1); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user2 winnings
    var depositBefore = await treasury.deposits.call(user2); 
    await withdraw(user2);
    var depositAfter = await treasury.deposits.call(user2); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('14')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    // check random user can't withdraw
    await shouldFail.reverting.withMessage(realitycards.withdraw({ from: user6 }), "Not a winner");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
  });

  it('test winner/withdraw mode 1', async () => {
    await rcfactory.setReferenceContractAddress(1,rcreference.address);
    var realitycards2 = await createMarketMode1();
    /////// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRentalCustomContract(realitycards2,1,0,user0); // collected 28
    await newRentalCustomContract(realitycards2,2,1,user1); // collected 52
    // rent winning team
    await newRentalCustomContract(realitycards2,1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2,2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalCustomContract(realitycards2,3,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards2.exitAll({from: user0});
    await realitycards2.exitAll({from: user1});
    await realitycards2.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    // winner 1: 
    // totalcollected = 147, 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards2.lockMarket(); 
    // // set winner 1
    await realitio.setResult(2);
    await realitycards2.determineWinner();
    ////////////////////////
    var totalCollected = await realitycards2.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    // check user0 and 1 winnings should fail cos user 2 winner
    await shouldFail.reverting.withMessage(realitycards2.withdraw({from:user0}), "Not a winner");
    await shouldFail.reverting.withMessage(realitycards2.withdraw({from:user1}), "Not a winner");
    //check user2 winnings
    var depositBefore = await treasury.deposits.call(user2); 
    await realitycards2.withdraw({from:user2});
    var depositAfter = await treasury.deposits.call(user2); 
    var winningsSentToUser = depositAfter - depositBefore;
    var difference = Math.abs(winningsSentToUser.toString()-totalCollected.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
  });

  it('test sponsor', async () => {
    await shouldFail.reverting.withMessage(realitycards.sponsor({ from: user3 }), "Must send something");
    await realitycards.sponsor({ value: web3.utils.toWei('153', 'ether'), from: user3 });
    ///// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRental(1,0,user0); // collected 28
    await newRental(2,1,user1); // collected 52
    // rent winning team
    await newRental(1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1));     
    // winner 1: 
    // totalcollected = 147, // now 300 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket(); 
    // set winner
    await realitio.setResult(2);
    await realitycards.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('300', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    //check user0 winnings
    var depositBefore = await treasury.deposits.call(user0); 
    await withdraw(user0);
    var depositAfter = await treasury.deposits.call(user0); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('300').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user0 cant withdraw again
    await shouldFail.reverting.withMessage(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.deposits.call(user1); 
    await withdraw(user1);
    var depositAfter = await treasury.deposits.call(user1); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('300').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user2 winnings
    var depositBefore = await treasury.deposits.call(user2); 
    await withdraw(user2);
    var depositAfter = await treasury.deposits.call(user2); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('300').mul(new BN('14')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    // check random user can't withdraw
    await shouldFail.reverting.withMessage(realitycards.withdraw({ from: user6 }), "Not a winner");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
  });

  it('test sponsor- invalid', async () => {
    await shouldFail.reverting.withMessage(realitycards.sponsor({ from: user3 }), "Must send something");
    await realitycards.sponsor({ value: web3.utils.toWei('153', 'ether'), from: user3 });
    ///// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRental(1,0,user0); // collected 28
    await newRental(2,1,user1); // collected 52
    // rent winning team
    await newRental(1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    // winner 1: 
    // totalcollected = 147, // now 300 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket(); 
    // set winner 
    await realitio.setResult(20);
    await realitycards.determineWinner();
    ////////////////////////
    //check sponsor winnings
    var depositBefore = await treasury.deposits.call(user3); 
    await withdraw(user3);
    var depositAfter = await treasury.deposits.call(user3); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('153');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
    await withdrawDeposit(1000,user3);
  });

it('test withdraw- invalid', async () => {
    /////// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRental(1,0,user0); // collected 28
    await newRental(2,1,user1); // collected 56
    // rent winning team
    await newRental(1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    // winner 1: 
    // totalcollected = 147, 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket(); 
    // set invalid winner
    await realitio.setResult(69);
    await realitycards.determineWinner();
    ////////////////////////
    // total deposits = 139, check:
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    //check user0 winnings
    var depositBefore = await treasury.deposits.call(user0); 
    await withdraw(user0);
    var depositAfter = await treasury.deposits.call(user0); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user0 cant withdraw again
    await shouldFail.reverting.withMessage(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.deposits.call(user1); 
    await withdraw(user1);
    var depositAfter = await treasury.deposits.call(user1); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user2 winnings
    var depositBefore = await treasury.deposits.call(user2); 
    await withdraw(user2);
    var depositAfter = await treasury.deposits.call(user2); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    // check random user can't withdraw
    await shouldFail.reverting.withMessage(realitycards.withdraw({ from: user6 }), "Paid no rent");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
    });

it('test circuitBreaker', async () => {
    /////// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRental(1,0,user0); // collected 28
    await newRental(2,1,user1); // collected 56
    // rent winning team
    await newRental(1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    // winner 1: 
    // totalcollected = 147, 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket(); 
    await time.increase(time.duration.weeks(24));
    await realitycards.circuitBreaker(); 
    ////////////////////////
    // total deposits = 139, check:
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    //check user0 winnings
    var depositBefore = await treasury.deposits.call(user0); 
    await withdraw(user0);
    var depositAfter = await treasury.deposits.call(user0); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('35');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user0 cant withdraw again
    await shouldFail.reverting.withMessage(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.deposits.call(user1); 
    await withdraw(user1);
    var depositAfter = await treasury.deposits.call(user1); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('70');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user2 winnings
    var depositBefore = await treasury.deposits.call(user2); 
    await withdraw(user2);
    var depositAfter = await treasury.deposits.call(user2); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('42');
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    // check random user can't withdraw
    await shouldFail.reverting.withMessage(realitycards.withdraw({ from: user6 }), "Paid no rent");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
    });

it('test circuitBreaker less than 1 month', async () => {
    /////// SETUP //////
    await depositDai(1000,user0);
    await newRental(1,0,user0); // collected 28
    await time.increase(time.duration.weeks(3));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await time.increase(time.duration.years(1)); 
    await realitycards.lockMarket(); 
    await shouldFail.reverting.withMessage(realitycards.circuitBreaker(), "Too early");
    await time.increase(time.duration.weeks(3));
    await realitycards.circuitBreaker();
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    });

it('check expected failures with market resolution: question not resolved but market ended', async () => {
    await depositDai(1000,user0);
    await newRental(1,0,user0); 
    await time.increase(time.duration.hours(1));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await time.increase(time.duration.years(1)); 
    await realitycards.lockMarket(); 
    await shouldFail.reverting.withMessage(realitycards.determineWinner(), "Oracle not resolved");
    await shouldFail.reverting.withMessage(realitycards.withdraw(), "Incorrect state");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
});

it('newRental check failures', async () => {
    /////// SETUP //////
    user = user0;
    await depositDai(1000,user0);
    // check newRental stuff
    await shouldFail.reverting.withMessage(realitycards.newRental(web3.utils.toWei('0.5', 'ether'),maxuint256,0,{ from: user}), "Minimum rental 1 Dai");
    await newRental(1,0,user0);
    await shouldFail.reverting.withMessage(realitycards.newRental(web3.utils.toWei('1', 'ether'),maxuint256,0,{ from: user}), "Price not 10% higher");
    await shouldFail.reverting.withMessage(realitycards.newRental(web3.utils.toWei('1', 'ether'),maxuint256,23,{ from: user}), "This token does not exist");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    });

it('check lockMarket cant be called too early', async () => {
    /////// SETUP //////
    await depositDai(1000,user0);
    await newRental(1,0,user0); 
    //// TESTS ////
    // call step 2 before step 1 done
    await shouldFail.reverting.withMessage(realitycards.determineWinner(), "Incorrect state");
    //call step 1 before markets ended
    await shouldFail.reverting.withMessage(realitycards.lockMarket(), "Market has not finished");
    await time.increase(time.duration.years(1)); 
    // // call step 1 after markets ended, should work
    await realitycards.lockMarket(); 
    // // call step 1 twice
    await shouldFail.reverting.withMessage(realitycards.lockMarket(), "Incorrect state");
    // // withdraw for next test
    await withdrawDeposit(1000,user0);
});

it('check that _revertToPreviousOwner does not revert more than ten times ', async () => {
    /////// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    await depositDai(1000,user3);
    // get user 0 and 1 to rent it 4 times
    await newRental(1,0,user0); 
    await newRental(2,0,user1);
    await newRental(3,0,user0);
    await newRental(4,0,user1);
    // get user 2 and 3 to rent it more than ten times
    await newRental(5,0,user2);
    await newRental(6,0,user3);
    await newRental(7,0,user2);
    await newRental(8,0,user3);
    await newRental(9,0,user2);
    await newRental(10,0,user3);
    await newRental(20,0,user2);
    await newRental(30,0,user3);
    await newRental(40,0,user2);
    await newRental(50,0,user3);
    await newRental(60,0,user2);
    await newRental(70,0,user3);
    // make sure owned for at least an hour
    await time.increase(time.duration.hours(1)); 
    // user 2 and 3 exit, it should return to one of them NOT return to user 0 or 1 
    await realitycards.exit(0,{ from: user2 });
    await realitycards.exit(0,{ from: user3 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user3);
    var price = await realitycards.price.call(0);
    assert.equal(price, web3.utils.toWei('6', 'ether'));
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
    await withdrawDeposit(1000,user3);
});

it('check that cannot rent a card if less than 1 hous rent', async () => {
    await depositDai(1,user0);
    await shouldFail.reverting.withMessage(realitycards.newRental(web3.utils.toWei('150', 'ether'),maxuint256,2,{ from: user0}), "Insufficient deposit");
    });

it('test payRent/deposits after 0 mins, 5 mins, 15 mins, 20 mins', async () => {
    user = user0;
    await depositDai(144,user);
    await newRental(144,0,user);
    // 0 mins
    var deposit = await treasury.deposits.call(user); 
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user,0);
    assert.equal(deposit, web3.utils.toWei('143', 'ether')); 
    assert.equal(depositSpecific, web3.utils.toWei('1', 'ether'));
    // 5 mins
    await time.increase(time.duration.minutes(5));
    await realitycards.collectRentAllTokens(); 
    var deposit = await treasury.deposits.call(user); 
    assert.equal(deposit, web3.utils.toWei('143', 'ether')); 
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user,0);
    var depositSpecificShouldBe = web3.utils.toWei('0.5', 'ether');
    var difference = Math.abs(depositSpecific.toString()-depositSpecificShouldBe.toString());
    assert.isBelow(difference/depositSpecificShouldBe,0.01);
    // 15 mins
    await time.increase(time.duration.minutes(10));
    await realitycards.collectRentAllTokens(); 
    var deposit = await treasury.deposits.call(user); 
    var depositShouldBe = web3.utils.toWei('142.5', 'ether');
    var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
    assert.isBelow(difference/depositShouldBe,0.01);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user,0);
    assert.equal(depositSpecific, 0);
    // 20 mins
    await time.increase(time.duration.minutes(5));
    await realitycards.collectRentAllTokens(); 
    var deposit = await treasury.deposits.call(user); 
    var depositShouldBe = web3.utils.toWei('142', 'ether');
    var difference = Math.abs(deposit.toString()-depositShouldBe.toString());
    assert.isBelow(difference/depositShouldBe,0.01);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user,0);
    assert.equal(depositSpecific, 0);
    await withdrawDeposit(1000,user0);
});

it('check that users cannot transfer their NFTs until withdraw state', async() => {
    user = user0;
    await depositDai(144,user);
    await newRental(1,2,user);
    var owner = await realitycards.ownerOf(2);
    assert.equal(owner, user);
    // buidler giving me shit when I try and intercept revert message so just testing revert, in OPEN state
    await shouldFail.reverting(realitycards.transferFrom(user,user1,2));
    await shouldFail.reverting(realitycards.safeTransferFrom(user,user1,2));
    await shouldFail.reverting(realitycards.safeTransferFrom(user,user1,2,web3.utils.asciiToHex("123456789")));
    await time.increase(time.duration.years(1)); 
    await realitycards.lockMarket();
    // // should fail cos LOCKED
    await shouldFail.reverting(realitycards.transferFrom(user,user1,2));
    await shouldFail.reverting(realitycards.safeTransferFrom(user,user1,2));
    await shouldFail.reverting(realitycards.safeTransferFrom(user,user1,2,web3.utils.asciiToHex("123456789")));
    await realitio.setResult(2);
    await realitycards.determineWinner();
    // // these shoudl all fail cos wrong owner:
    var owner = await realitycards.ownerOf(2);
    assert.equal(owner, user);
    await shouldFail.reverting(realitycards.transferFrom(user,user1,2,{from: user1}));
    await shouldFail.reverting(realitycards.safeTransferFrom(user1,user1,2,{from: user1}));
    // these should not
    await realitycards.transferFrom(user,user1,2,{from: user});
    await realitycards.safeTransferFrom(user1,user,2,{from: user1});
  });

  it('make sure functions cant be called in the wrong state', async() => {
    user = user0;
    realitycards2 = realitycards; // cos later we will add realitycards2 back
    var state = await realitycards2.state.call();
    assert.equal(1,state);
    // currently in state 'OPEN' the following should all fail 
    await shouldFail.reverting.withMessage(realitycards2.determineWinner(), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.withdraw(), "Incorrect state");
    // increment state
    await time.increase(time.duration.years(1)); 
    await realitycards2.lockMarket();
    var state = await realitycards2.state.call();
    assert.equal(2,state);
    // currently in state 'LOCKED' the following should all fail 
    await shouldFail.reverting.withMessage(realitycards2.collectRentAllTokens(), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.newRental(0,maxuint256,0), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.exit(0), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.rentAllCards(), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.sponsor({value: 3}), "Incorrect state");
    // increment state
    await realitio.setResult(1);
    await realitycards2.determineWinner();
    var state = await realitycards2.state.call();
    assert.equal(3,state);
    // currently in state 'WITHDRAW' the following should all fail 
    await shouldFail.reverting.withMessage(realitycards2.lockMarket(), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.determineWinner(), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.collectRentAllTokens(), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.newRental(0,maxuint256,0), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.exit(0), "Incorrect state");
    await shouldFail.reverting.withMessage(realitycards2.sponsor({value: 3}), "Incorrect state");
  });

it('check oracleResolutionTime and marketLockingTime expected failures', async () => {
    // someone else deploys question to realitio
    var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
    var arbitrator = "0xA6EAd513D05347138184324392d8ceb24C116118";
    var timeout = 86400;
    var templateId = 2;
    var tokenName = "x";
    // resolution time before locking, expect failure
    var oracleResolutionTime = 69419;
    var marketLockingTime = 69420; 
    var timestamps = [0,marketLockingTime,oracleResolutionTime];
    await shouldFail.reverting.withMessage(rcfactory.createMarket(0,'0x0',timestamps, tokenURIs, question,tokenName), "Invalid timestamps");
    // resolution time > 1 weeks after locking, expect failure
    var oracleResolutionTime = 604810;
    var marketLockingTime = 0; 
    var timestamps = [0,marketLockingTime,oracleResolutionTime];
    await shouldFail.reverting.withMessage(rcfactory.createMarket(0,'0x0',timestamps, tokenURIs, question,tokenName), "Invalid timestamps");
    // resolution time < 1 week  after locking, no failure
    var oracleResolutionTime = 604790;
    var marketLockingTime = 0; 
    var timestamps = [0,marketLockingTime,oracleResolutionTime];
    await rcfactory.createMarket(0,'0x0',timestamps, tokenURIs, question,tokenName);
    // same time, no failure
    var oracleResolutionTime = 0;
    var marketLockingTime = 0; 
    var timestamps = [0,marketLockingTime,oracleResolutionTime];
    await rcfactory.createMarket(0,'0x0',timestamps, tokenURIs, question,tokenName);
  });

  it('test longestTimeHeld & longestOwner', async () => {
    await depositDai(10,user0);
    await newRental(1,2,user0);
    // await newRental(web3.utils.toWei('1', 'ether'),2,web3.utils.toWei('10', 'ether'),user0 ); 
    await time.increase(time.duration.days(1)); 
    await realitycards.collectRentAllTokens();
    var maxTimeHeld = await realitycards.longestTimeHeld(2);
    var maxTimeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(maxTimeHeld.toString() - maxTimeHeldShouldBe.toString());
    assert.isBelow(difference/maxTimeHeld,0.0001);
    var longestOwner = await realitycards.longestOwner(2);
    var longestOwnerShouldBe = user0;
    assert.equal(longestOwner, longestOwnerShouldBe);
    // try again new owner
    await depositDai(10,user1);
    await newRental(2,2,user1);
    // await newRental(web3.utils.toWei('2', 'ether'),2,web3.utils.toWei('10', 'ether'),user1 ); 
    await time.increase(time.duration.days(2));
    await realitycards.collectRentAllTokens();
    var maxTimeHeld = await realitycards.longestTimeHeld(2);
    var maxTimeHeldShouldBe = time.duration.days(2);
    var difference = Math.abs(maxTimeHeld.toString() - maxTimeHeldShouldBe.toString());
    assert.isBelow(difference/maxTimeHeld,0.0001);
    var longestOwner = await realitycards.longestOwner(2);
    var longestOwnerShouldBe = user1;
    assert.equal(longestOwner, longestOwnerShouldBe);
  });

it('test NFT allocation after event- winner', async () => {
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    await newRental(1,0,user0); 
    await newRental(1,1,user1); 
    await newRental(1,2,user2);
    await time.increase(time.duration.weeks(1));
    await newRental(2,0,user1); //user 1 winner
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    ////////////////////////
    await realitycards.lockMarket(); 
    // set winner
    await realitio.setResult(0);
    await realitycards.determineWinner();
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner,user1);
    for (i = 1; i < 20; i++) {
        await shouldFail.reverting.withMessage(realitycards.ownerOf(i), "ERC721: owner query for nonexistent token");
    }
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});

it('test NFT allocation after event- circuit breaker', async () => {
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    await newRental(1,0,user0); 
    await newRental(1,1,user1); 
    await newRental(1,2,user2);
    await time.increase(time.duration.weeks(1));
    await newRental(2,0,user1); //user 1 winner
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    ////////////////////////
    await realitycards.lockMarket(); 
    await time.increase(time.duration.weeks(2));
    await realitycards.circuitBreaker();
    for (i = 0; i < 20; i++) {
        await shouldFail.reverting.withMessage(realitycards.ownerOf(i), "ERC721: owner query for nonexistent token");
    }
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});

it('test NFT allocation after event- nobody owns winner', async () => {
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    await newRental(1,0,user0); 
    await newRental(1,1,user1); 
    await newRental(1,2,user2);
    await time.increase(time.duration.weeks(1));
    await newRental(2,0,user1); //user 1 winner
    await time.increase(time.duration.weeks(2));
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    ////////////////////////
    await realitycards.lockMarket(); 
    // set winner
    await realitio.setResult(4);
    await realitycards.determineWinner();
    for (i = 0; i < 20; i++) {
        await shouldFail.reverting.withMessage(realitycards.ownerOf(i), "ERC721: owner query for nonexistent token");
    }
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});

it('deploy new reference contract, does it still work? test withdraw', async () => {
    var marketLockingTime = await time.latest();
    var oracleResolutionTime = await time.latest();
    var timestamps = [marketLockingTime,oracleResolutionTime];
    rcreference2 = await RCMarket.new();
    var referenceContractAddressBefore = await rcfactory.getMostRecentReferenceContract(0);
    // first check it will not allow dummy contract to be deployed
    var dummy = await RealitioMockup.new();
    await shouldFail.reverting.withMessage(rcfactory.setReferenceContractAddress(0,dummy.address), "reverted");
    // carry on as before

    await rcfactory.setReferenceContractAddress(0,rcreference2.address);
    var referenceContractAddressAfter = await rcfactory.getMostRecentReferenceContract(0);
    // chcek the reference contract address has changed
    assert.notEqual(referenceContractAddressBefore,referenceContractAddressAfter);
    // new market with different reference contract
    realitycards = await createMarket();
    // now normal withdraw test
    /////// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRental(1,0,user0); // collected 28
    await newRental(2,1,user1); // collected 52
    // rent winning team
    await newRental(1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRental(3,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    await realitycards.lockMarket(); 
    // set winner
    await realitio.setResult(2);
    await realitycards.determineWinner();
    ////////////////////////
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    //check user0 winnings
    var depositBefore = await treasury.deposits.call(user0); 
    await withdraw(user0);
    var depositAfter = await treasury.deposits.call(user0); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user0 cant withdraw again
    await shouldFail.reverting.withMessage(withdraw(user0), "Already withdrawn");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});

it('check that card specific deposit is only allocated once', async () => {
    await depositDai(1000,user0);
    await newRental(144,0,user0);
    // check user 0 has 1 card specific deposit
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user0,0);
    var depositSpecificShouldBe = web3.utils.toWei('1', 'ether');
    var difference = Math.abs(depositSpecific.toString()-depositSpecificShouldBe.toString());
    assert.isBelow(difference/depositSpecificShouldBe,0.01);
    // repeat, should now be 2, not or 1 (i.e. unchaged)
    await newRental(288,0,user0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user0,0);
    var depositSpecificShouldBe = web3.utils.toWei('2', 'ether');
    var difference = Math.abs(depositSpecific.toString()-depositSpecificShouldBe.toString());
    assert.isBelow(difference/depositSpecificShouldBe,0.01)
    // withdraw for next test
    await withdrawDeposit(1000,user0);
});

it('check card specific deposit is removed when there is a new renter', async () => {
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await newRental(144,0,user0);
    // check user 0 has 1 card specific deposit
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user0,0);
    var depositSpecificShouldBe = web3.utils.toWei('1', 'ether');
    var difference = Math.abs(depositSpecific.toString()-depositSpecificShouldBe.toString());
    assert.isBelow(difference/depositSpecificShouldBe,0.01);
    // user 1 rents, check user 0 now has zero deposit and user1 has 2
    await newRental(288,0,user1);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user0,0);
    assert.equal(depositSpecific,0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user1,0);
    var depositSpecificShouldBe = web3.utils.toWei('2', 'ether');
    var difference = Math.abs(depositSpecific.toString()-depositSpecificShouldBe.toString());
    assert.isBelow(difference/depositSpecificShouldBe,0.01);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
});

it('test exit but then can rent again', async () => {
    // setup
    await depositDai(144,user0);
    await depositDai(144,user1);
    await newRental(10,0,user0);
    await newRental(144,0,user1);
    await time.increase(time.duration.hours(1)); 
    await realitycards.collectRentAllTokens();
    // exit, ownership reverts back to 1
    await realitycards.exit(0,{ from: user1 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    // user1 rents again should be new owner
    await newRental(144,0,user1);
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    await time.increase(time.duration.hours(1)); 
    await realitycards.collectRentAllTokens();
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user1);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
});

it('test _revertToPreviousOwner will not revert to user if exit flag set', async () => {
    // setup
    await depositDai(144,user0);
    await depositDai(144,user1);
    await depositDai(144,user2);
    await newRental(100,0,user0);
    await newRental(144,0,user1);
    await newRental(288,0,user2);
    // user 1 exits
    await realitycards.exit(0,{ from: user1 });
    // user 2 should still own
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user2);
    // user 2 has enough for 12 hours, so go 13 hours and check user0 owns it
    await time.increase(time.duration.hours(13)); 
    await realitycards.collectRentAllTokens();
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
});

it('test _revertToPreviousOwner will revert properly if current owner has deposit but previous owner does not', async () => {
    // setup
    await depositDai(144,user0);
    await depositDai(144,user1);
    await depositDai(144,user2);
    await newRental(72,0,user0);
    await newRental(144,0,user1);
    // 20 mins pass so card speciifc used, then withdraw the rest for user1
    await time.increase(time.duration.minutes(20)); 
    await newRental(288,0,user2)
    await withdrawDeposit(1000,user1);
    // check that user 1 has zero deposit
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user1,0);
    assert.equal(depositSpecific,0);
    var deposit = await treasury.deposits.call(user1); 
    assert.equal(deposit,0);
    // pass an hour and then exit so user 2 has insufficinet card deposit but there is still some, should return to zero
    await time.increase(time.duration.days(3)); 
    await realitycards.exit(0,{ from: user2 });
    var owner = await realitycards.ownerOf.call(0);
    assert.equal(owner, user0);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
});

it('test marketOpeningTime stuff', async () => {
    await depositDai(144,user0);
    // // check that state is 1 if marketopening time in the past
    var realitycards2 = await createMarketCustomeTimestamps(100,100,100);
    var state = await realitycards2.state();
    assert.equal(state,1);
    var latestTime = await time.latest();
    var oneMonth = new BN('2592000');
    var oneYear = new BN('31104000');
    var oneMonthInTheFuture = oneMonth.add(latestTime);
    var oneYearInTheFuture = oneYear.add(latestTime);
    var realitycards3 = await createMarketCustomeTimestamps(oneMonthInTheFuture,oneYearInTheFuture,oneYearInTheFuture);
    // check that if in the future, state 0 originally
    // just use the default realitycards
    var state = await realitycards3.state();
    assert.equal(state,0);
    // check newRental fails because incorrect state
    await shouldFail.reverting.withMessage(realitycards3.newRental(web3.utils.toWei('150', 'ether'),maxuint256,2,{ from: user0}), "Incorrect state");
    // advance time so its in the past, should work
    await time.increase(time.duration.weeks(8)); 
    await realitycards3.newRental(web3.utils.toWei('150', 'ether'),maxuint256,2,{ from: user0})
    // check that it won't increment state twice
    await realitycards3.newRental(web3.utils.toWei('200', 'ether'),maxuint256,2,{ from: user0})
    var state = await realitycards3.state();
    assert.equal(state,1);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
});

it('check that non markets cannot call market only functions on Treasury', async () => {
    await shouldFail.reverting.withMessage(treasury.allocateCardSpecificDeposit(user0,user0,0,0), "Not authorised");
    await shouldFail.reverting.withMessage(treasury.payRent(user0,user0,0,0), "Not authorised");
    await shouldFail.reverting.withMessage(treasury.payout(user0,0), "Not authorised");
});

it('check that cant send ether to the contract direct', async () => {
    await shouldFail.reverting.withMessage(treasury.send(1), "Verboten");
});

it('check onlyOwner is on everything it should be', async () => {
    // first check that they can only be called by owner
    await shouldFail.reverting.withMessage(rcfactory.setReferenceContractAddress(0,user1,{from: user1}), "caller is not the owner");
    await shouldFail.reverting.withMessage(rcfactory.updateRealitioTimeout(1), "24 hours min");
    await shouldFail.reverting.withMessage(rcfactory.updateArbitrator(user1,{from: user1}), "caller is not the owner");
    await shouldFail.reverting.withMessage(rcfactory.updateRealitioAddress(user1,{from: user1}), "caller is not the owner");
    // check that realitio address is actually changed (cant check the others as local only)
    await rcfactory.updateRealitioAddress(user1);
    var realitycards2 = await createMarket();
    var realitoAddress = await realitycards2.realitio.call();
    assert.equal(realitoAddress,user1);
});

it('check that ownership can not be changed unless correct owner, treasury and factory', async() => {
    await shouldFail.reverting.withMessage(rcfactory.transferOwnership(user1,{from: user1}), "caller is not the owner");
    await shouldFail.reverting.withMessage(treasury.transferOwnership(user1,{from: user1}), "caller is not the owner");
    // check that works fine if owner
    await rcfactory.transferOwnership(user1,{from: user0});
    await treasury.transferOwnership(user1,{from: user0});
    // check that ownership changed
    var newOwner = await rcfactory.owner.call();
    assert.equal(newOwner, user1);
    var newOwner = await treasury.owner.call();
    assert.equal(newOwner, user1);
  });

  it('check renounce ownership works, treasury and factory', async() => {
    await shouldFail.reverting.withMessage(rcfactory.renounceOwnership({from: user1}), "caller is not the owner");
    await shouldFail.reverting.withMessage(treasury.renounceOwnership({from: user1}), "caller is not the owner");
    // check that works fine if owner
    await rcfactory.renounceOwnership({from: user0});
    await treasury.renounceOwnership({from: user0});
    // check that ownership changed
    var newOwner = await rcfactory.owner.call();
    assert.equal(newOwner, 0);
    var newOwner = await treasury.owner.call();
    assert.equal(newOwner, 0);
  });

it('test timeHeldLimit', async() => {
    await depositDai(144,user0);
    await depositDai(144,user1);
    // first: check timeHeldLimit cant be below ten mins
    await shouldFail.reverting.withMessage(realitycards.newRental(web3.utils.toWei('1', 'ether'),'500',0,{ from: user0}), "Ten mins min");
    // second: limit is below rent owed and below total deposit
    // rent a card for one day only
    await newRentalCustomTimeLimit(1,1,0,user0);
    await newRentalCustomTimeLimit(5,1,0,user1);
    // do a minor interval to check it isnt reverting yet
    await time.increase(time.duration.hours(11));
    await realitycards.collectRentAllTokens();
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner,user1);
    await time.increase(time.duration.weeks(10));
    await realitycards.collectRentAllTokens();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    // check they paid 5 dai
    var collected = await realitycards.collectedPerUser(user1);
    var collectedShouldBe = web3.utils.toWei('5', 'ether');
    var difference = Math.abs(collected.toString() - collectedShouldBe.toString()); 
    assert.isBelow(difference/collected,0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner,user0);
    // third: deposit is below rent owed and below limit
    await depositDai(144,user2);
    await depositDai(144,user3);
    await newRentalCustomTimeLimit(1,1,1,user2);
    await newRentalCustomTimeLimit(144,100,1,user3);
    await time.increase(time.duration.days(2));
    await realitycards.collectRentAllTokens();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(1, user3);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(1);
    assert.equal(owner,user2);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});

it('test winner/withdraw, recreated without exit', async () => {
    /////// SETUP //////
    await depositDai(1000,user0);
    await depositDai(1000,user1);
    await depositDai(1000,user2);
    // rent losing teams
    await newRentalCustomTimeLimit(1,28,0,user0); // collected 28
    await newRentalCustomTimeLimit(2,28,1,user1); // collected 56
    // rent winning team
    await newRental(1,2,user0); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRental(2,2,user1); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalCustomTimeLimit(3,14,2,user2); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await time.increase(time.duration.years(1)); 
    // winner 1: 
    // totalcollected = 147, 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket(); 
    // // set winner 1
    await realitio.setResult(2);
    await realitycards.determineWinner();
    ////////////////////////
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    // //check user0 winnings
    var depositBefore = await treasury.deposits.call(user0); 
    await withdraw(user0);
    var depositAfter = await treasury.deposits.call(user0); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user0 cant withdraw again
    await shouldFail.reverting.withMessage(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.deposits.call(user1); 
    await withdraw(user1);
    var depositAfter = await treasury.deposits.call(user1); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user2 winnings
    var depositBefore = await treasury.deposits.call(user2); 
    await withdraw(user2);
    var depositAfter = await treasury.deposits.call(user2); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('14')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    // check random user can't withdraw
    await shouldFail.reverting.withMessage(realitycards.withdraw({ from: user6 }), "Not a winner");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});

it('test timeHeldLimit using updateTimeHeldLimit', async() => {
    await depositDai(144,user0);
    await depositDai(144,user1);
    // first: check timeHeldLimit cant be below ten mins
    await shouldFail.reverting.withMessage(realitycards.updateTimeHeldLimit('500',0,{ from: user0}), "Ten mins min");
    // second: limit is below rent owed and below total deposit
    // rent a card for one day only
    await newRental(1,0,user0);
    await realitycards.updateTimeHeldLimit(86400,0,{from: user0});
    await newRental(5,0,user1);
    await realitycards.updateTimeHeldLimit(86400,0,{from: user1});
    // do a minor interval to check it isnt reverting yet
    await time.increase(time.duration.hours(11));
    await realitycards.collectRentAllTokens();
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner,user1);
    await time.increase(time.duration.weeks(10));
    await realitycards.collectRentAllTokens();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(0, user1);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    // check they paid 5 dai
    var collected = await realitycards.collectedPerUser(user1);
    var collectedShouldBe = web3.utils.toWei('5', 'ether');
    var difference = Math.abs(collected.toString() - collectedShouldBe.toString()); 
    assert.isBelow(difference/collected,0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner,user0);
    // third: deposit is below rent owed and below limit
    await depositDai(144,user2);
    await depositDai(144,user3);
    await newRentalCustomTimeLimit(1,1,1,user2);
    await newRentalCustomTimeLimit(144,100,1,user3);
    await time.increase(time.duration.days(2));
    await realitycards.collectRentAllTokens();
    // check that only owned for 1 day
    var timeHeld = await realitycards.timeHeld.call(1, user3);
    var timeHeldShouldBe = time.duration.days(1);
    var difference = Math.abs(timeHeld.toString() - timeHeldShouldBe.toString()); 
    assert.isBelow(difference/timeHeld,0.001);
    // check that it reverted
    var owner = await realitycards.ownerOf(1);
    assert.equal(owner,user2);
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});


it('test newRentalWithDeposit', async() => {
    // var amount = web3.utils.toWei('144', 'ether')
    await newRentalWithDeposit(144,0,user0,144);
    // check that rent worked
    var owner = await realitycards.ownerOf(0);
    assert.equal(owner,user0);
    // check deposits are correct
    var deposit = await treasury.deposits.call(user0)
    var depositShouldBe = web3.utils.toWei('143', 'ether');
    assert.equal(deposit,depositShouldBe);
    marketAddress = await rcfactory.getMostRecentMarket.call(0);
    var depositSpecific = await treasury.cardSpecificDeposits.call(marketAddress,user0,0);
    assert.equal(depositSpecific, web3.utils.toWei('1', 'ether'));
});

it('test winner/withdraw recreated using newRentalWithDeposit', async () => {
    /////// SETUP //////
    // var amount = web3.utils.toWei('144', 'ether')
    // var price = web3.utils.toWei('1', 'ether')
    // rent losing
    await newRentalWithDeposit(1,0,user0,144); // collected 28
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('1', 'ether'),maxuint256,0,{from: user0, value: web3.utils.toWei('144', 'ether')}); // collected 28
    await newRentalWithDeposit(2,1,user1,144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('2', 'ether'),maxuint256,1,{from: user1, value: web3.utils.toWei('144', 'ether')}); // collected 52
    // rent winning
    await newRentalWithDeposit(1,2,user0,144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('1', 'ether'),maxuint256,2,{from: user0, value: web3.utils.toWei('144', 'ether')}); // collected 7
    await time.increase(time.duration.weeks(1));
    await newRentalWithDeposit(2,2,user1,144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('2', 'ether'),maxuint256,2,{from: user1, value: web3.utils.toWei('144', 'ether')}); // collected 14
    await time.increase(time.duration.weeks(1));
    await newRentalWithDeposit(3,2,user2,144);
    // await realitycards.newRentalWithDeposit(web3.utils.toWei('3', 'ether'),maxuint256,2,{from: user2, value: web3.utils.toWei('144', 'ether')}); // collected 42
    await time.increase(time.duration.weeks(2)); 
    // exit all, progress time so marketLockingTime in the past
    await realitycards.exitAll({from: user0});
    await realitycards.exitAll({from: user1});
    await realitycards.exitAll({from: user2});
    await time.increase(time.duration.years(1)); 
    // winner 1: 
    // totalcollected = 147, 
    // total days = 28 
    // user 0 owned for 7 days
    // user 1 owned for 7 days
    // user 2 owned for 14 days
    ////////////////////////
    await realitycards.lockMarket(); 
    // // set winner 1
    await realitio.setResult(2);
    await realitycards.determineWinner();
    ////////////////////////
    var totalCollected = await realitycards.totalCollected.call();
    var totalCollectedShouldBe = web3.utils.toWei('147', 'ether');
    var difference = Math.abs(totalCollected.toString()-totalCollectedShouldBe.toString());
    assert.isBelow(difference/totalCollected,0.00001);
    // //check user0 winnings
    var depositBefore = await treasury.deposits.call(user0); 
    await withdraw(user0);
    var depositAfter = await treasury.deposits.call(user0); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user0 cant withdraw again
    await shouldFail.reverting.withMessage(withdraw(user0), "Already withdrawn");
    //check user1 winnings
    var depositBefore = await treasury.deposits.call(user1); 
    await withdraw(user1);
    var depositAfter = await treasury.deposits.call(user1); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('7')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    //check user2 winnings
    var depositBefore = await treasury.deposits.call(user2); 
    await withdraw(user2);
    var depositAfter = await treasury.deposits.call(user2); 
    var winningsSentToUser = depositAfter - depositBefore;
    var winningsShouldBe = ether('147').mul(new BN('14')).div(new BN('28'));
    var difference = Math.abs(winningsSentToUser.toString() - winningsShouldBe.toString());
    assert.isBelow(difference/winningsSentToUser,0.00001);
    // check random user can't withdraw
    await shouldFail.reverting.withMessage(realitycards.withdraw({ from: user6 }), "Not a winner");
    // withdraw for next test
    await withdrawDeposit(1000,user0);
    await withdrawDeposit(1000,user1);
    await withdrawDeposit(1000,user2);
});


});
