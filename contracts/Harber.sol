pragma solidity 0.6.6;
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/ICash.sol";
import "./interfaces/IRealitio.sol";
import "./Token.sol";

/// @title Harber
/// @author Andrew Stanger

contract Harber {

    using SafeMath for uint256;

    ////////////////////////////////////
    //////// VARIABLES /////////////////
    ////////////////////////////////////

    /// CONTRACT SETUP
    /// @dev not set in the constructor because so many other variables need it for initating.  
    uint256 constant private numberOfTokens = 20;
    /// @dev counts how many NFTs have been minted 
    /// @dev when nftMintCount = numberOfTokens, allNftsMinted -> true
    uint256 private nftMintCount;
    /// @dev must be true for any functions to work (except mintNfts)
    bool private allNftsMinted;
    /// @dev for circuit breaker
    address private owner; 
    /// @dev the question ID of the question on realitio
    bytes32 public questionId;
    /// @dev only for _revertToPreviousOwner to prevent gas limits
    uint256 constant private MAX_ITERATIONS = 10;
    enum States {NFTSNOTMINTED, OPEN, LOCKED, WITHDRAW}
    States public state; 

    /// CONTRACT VARIABLES
    Token public token;
    IRealitio public realitio;
    ICash public cash; 

    /// NFT/USER DATA
    /// @dev in attodai (so $100 = 100000000000000000000)
    uint256[numberOfTokens] public price; 
    /// @dev used to determine the rent due. Rent is due for the period (now - timeLastCollected), at which point timeLastCollected is set to now.
    uint256[numberOfTokens] public timeLastCollected; 
    /// @dev when a token was bought. Used to enforce minimum of one hour rental, also used in front end. Rent collection does not need this, only needs timeLastCollected.
    uint256[numberOfTokens] public timeAcquired; 
    /// @dev tracks the position of the current owner in the ownerTracker mapping
    uint256[numberOfTokens] public currentOwnerIndex; 
    /// @dev an easy way to track the above across all tokens. It should always increment at the same time as the above increments. 
    uint256 public totalCollected; 
    
    /// WINNING OUTCOME VARIABLES
    /// @dev start with invalid winning outcome
    uint256 public winningOutcome = 42069; 
    //// @dev when the question can be answered on Realitio. 
    uint32 public marketExpectedResolutionTime; 

    /// MARKET RESOLUTION VARIABLES
    bool public questionResolvedInvalid = true; // set in step 2. If false, normal payout. If true, return all funds
    
    ///  STRUCTS
    struct purchase {
        address owner;
        uint256 price;
    }
    
    /// MAPPINGS
    /// @dev keeps track of all previous owners of a token, including the price, so that if the current owner's deposit runs out,
    /// @dev ...ownership can be reverted to a previous owner with the previous price. Index 0 is NOT used, this tells the contract to foreclose.
    /// @dev this does NOT keep a reliable list of all owners, if it reverts to a previous owner then the next owner will overwrite the owner that was in that slot.
    /// @dev the variable currentOwnerIndex is used to track the location of the current owner. 
    mapping (uint256 => mapping (uint256 => purchase) ) public ownerTracker;  
    /// @dev how many seconds each user has held each token for, for determining winnings  
    mapping (uint256 => mapping (address => uint256) ) public timeHeld;
    /// @dev sums all the timeHelds for each  Not required, but saves on gas when paying out. Should always increment at the same time as timeHeld
    mapping (uint256 => uint256) public totalTimeHeld; 
    /// @dev keeps track of all the deposits for each token, for each owner. Unused deposits are not returned automatically when there is a new buyer. 
    /// @dev they can be withdrawn manually however. Unused deposits are returned automatically upon resolution of the market
    mapping (uint256 => mapping (address => uint256) ) public deposits; 
    /// @dev keeps track of all the rent paid by each user. So that it can be returned in case of an invalid market outcome. Only required in this instance. 
    mapping (address => uint256) public collectedPerUser;
    /// @dev keeps track of all the rent paid for each  Front end only
    mapping (uint256 => uint256) public collectedPerToken;

    ////////////////////////////////////
    //////// CONSTRUCTOR ///////////////
    ////////////////////////////////////

    constructor(address _owner, Token _addressOfTokenContract, ICash _addressOfCashContract, IRealitio _addressOfRealitioContract, uint32 _marketExpectedResolutionTime)  public
    {
        //assign arguments to relevant variables
        marketExpectedResolutionTime = _marketExpectedResolutionTime;
        owner = _owner;
        
        // external contract variables:
        token = _addressOfTokenContract;
        realitio = _addressOfRealitioContract;
        cash = _addressOfCashContract;

        // Create the question on Realitio
        uint256 template_id = 2;
        string memory question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
        address arbitrator = 0xA6EAd513D05347138184324392d8ceb24C116118; // to change
        uint32 timeout = 86400; // 24 hours
        uint32 opening_ts = _marketExpectedResolutionTime;
        uint256 nonce = 0;
        questionId = _postQuestion(template_id, question, arbitrator, timeout, opening_ts, nonce);
    } 

    ////////////////////////////////////
    //////// EVENTS ////////////////////
    ////////////////////////////////////

    event LogNewRental(address indexed newOwner, uint256 indexed newPrice, uint256 indexed tokenId);
    event LogPriceChange(uint256 indexed newPrice, uint256 indexed tokenId);
    event LogForeclosure(address indexed prevOwner, uint256 indexed tokenId);
    event LogRentCollection(uint256 indexed rentCollected, uint256 indexed tokenId);
    event LogReturnToPreviousOwner(uint256 indexed tokenId, address indexed previousOwner);
    event LogDepositWithdrawal(uint256 indexed daiWithdrawn, uint256 indexed tokenId, address indexed returnedTo);
    event LogDepositIncreased(uint256 indexed daiDeposited, uint256 indexed tokenId, address indexed sentBy);
    event LogStep1Complete(bool indexed didTheEventFinish);
    event LogStep2Complete(bool indexed didRealitioResolve, uint256 indexed winningOutcome, bool indexed didRealitioResolveInvalid);
    event LogWinningsPaid(address indexed paidTo, uint256 indexed amountPaid);
    event LogRentReturned(address indexed returnedTo, uint256 indexed amountReturned);
    event TestingVariable(uint indexed testingVariable);

    ////////////////////////////////////
    //////// INITIAL SETUP /////////////
    ////////////////////////////////////

    /// @notice set this contract as owner of the Token contract
    function setTokenOwner() external {
        token.setOwner();
    }

    /// @notice mint the NFTs. Must setTokenOwner first or will revert
    function mintNfts(string calldata _uri) external checkState(States.NFTSNOTMINTED) {
        token.mint(address(this), nftMintCount, _uri); 
        nftMintCount = nftMintCount.add(1);
        if (nftMintCount == numberOfTokens) {
            _incrementState();
            token.lock();
        }
    }

    ////////////////////////////////////
    /////////// MODIFIERS //////////////
    ////////////////////////////////////

    modifier checkState(States currentState) {
        require(state == currentState, "Incorrect state");
        _;
    }

    /// @notice checks the token exists
    modifier tokenExists(uint256 _tokenId) {
        require(_tokenId  >= 0 && _tokenId < numberOfTokens, "This token does not exist");
       _;
    }

    /// @notice what it says on the tin
    modifier amountNotZero(uint256 _dai) {
        require(_dai  > 0, "Amount must be above zero");
       _;
    }

    /// @notice what it says on the tin
    modifier onlyTokenOwner(uint256 _tokenId) {
        require(msg.sender == token.ownerOf(_tokenId), "Not owner");
       _;
    }

    ////////////////////////////////////
    //////// VIEW FUNCTIONS ////////////
    ////////////////////////////////////

    /// @dev called in collectRent function, and various other view functions 
    function rentOwed(uint256 _tokenId) public view returns (uint256) {
        return price[_tokenId].mul(now.sub(timeLastCollected[_tokenId])).div(1 days);
    }

    /// @dev used in testing only
    function getOwnerTrackerPrice(uint256 _tokenId, uint256 _index) external view returns (uint256) {
        return (ownerTracker[_tokenId][_index].price);
    }

    /// @dev used in testing only
    function getOwnerTrackerAddress(uint256 _tokenId, uint256 _index) external view returns (address) {
        return (ownerTracker[_tokenId][_index].owner);
    }

    /// @dev for front end only
    /// @return how much the current owner has deposited
    function liveDepositAbleToWithdraw(uint256 _tokenId) public view returns (uint256) {
        uint256 _rentOwed = rentOwed(_tokenId);
        address _currentOwner = token.ownerOf(_tokenId);
        if(_rentOwed >= deposits[_tokenId][_currentOwner]) {
            return 0;
        } else {
            return deposits[_tokenId][_currentOwner].sub(_rentOwed);
        }
    }

    /// @dev for front end only
    /// @return how much the current user has deposited (note: user not owner)
    function userDepositAbleToWithdraw(uint256 _tokenId) external view returns (uint256) {
        uint256 _rentOwed = rentOwed(_tokenId);
        address _currentOwner = token.ownerOf(_tokenId);

        if(_currentOwner == msg.sender) {
            if(_rentOwed >= deposits[_tokenId][msg.sender]) {
                return 0;
            } else {
                return deposits[_tokenId][msg.sender].sub(_rentOwed);
            }
        } else {
            return deposits[_tokenId][msg.sender];
        }
    }

    /// @dev for front end only
    /// @return estimated rental expiry time
    function rentalExpiryTime(uint256 _tokenId) external view returns (uint256) {
        uint256 pps;
        pps = price[_tokenId].div(1 days);
        if (pps == 0) {
            return now; //if price is so low that pps = 0 just return current time as a fallback
        }
        else {
            return now + liveDepositAbleToWithdraw(_tokenId).div(pps);
        }
    }

    /// @dev for front end and _payoutWinnings function
    function getWinnings(uint256 _winningOutcome) public view returns (uint256) {
        uint256 _winnersTimeHeld = timeHeld[_winningOutcome][msg.sender];
        uint256 _numerator = totalCollected.mul(_winnersTimeHeld);
        uint256 _winnings = _numerator.div(totalTimeHeld[winningOutcome]);    
        return _winnings;    
    }
    
    ////////////////////////////////////
    ///// EXTERNAL DAI FUNCTIONS ///////
    ////////////////////////////////////

    // * internal * 
    /// @notice common function for all outgoing DAI transfers
    function _sendCash(address _to, uint256 _amount) internal { 
        require(cash.transfer(_to,_amount), "Cash transfer failed"); 
    }

    // * internal * 
    /// @notice common function for all incoming DAI transfers
    function _receiveCash(address _from, uint256 _amount) internal {  
        require(cash.transferFrom(_from, address(this), _amount), "Cash transfer failed");
    }

    ////////////////////////////////////
    //// EXTERNAL REALITIO FUNCTIONS ///
    ////////////////////////////////////

    /// @notice posts the question to realit.io
    function _postQuestion(uint256 template_id, string memory question, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce) internal returns (bytes32) {
        return realitio.askQuestion(template_id, question, arbitrator, timeout, opening_ts, nonce);
    }

    /// @notice gets the winning outcome from realitio
    /// @dev the returned value is equivilent to tokenId
    /// @dev this function call will revert if it has not yet resolved
    function _getWinner() internal view returns(uint256) {
        bytes32 _winningOutcome = realitio.resultFor(questionId);
        return uint256(_winningOutcome);
    }

    /// @notice has the question been finalized on realitio?
    function _isQuestionFinalized() internal view returns (bool) {
        return realitio.isFinalized(questionId);
    }

    ////////////////////////////////////
    //// MARKET RESOLUTION FUNCTIONS ///
    ////////////////////////////////////

    /// @notice the first of two functions which must be called, one after the other, to conclude the competition
    /// @notice winnings can be paid out (or funds returned) only when these three steps are completed
    /// @notice this function checks whether the competition has ended (1 hour grace), if so closes down all 'ordinary course of business' functions
    /// @dev can be called by anyone 
    function step1checkMarketEnded() external checkState(States.OPEN) {
        require(marketExpectedResolutionTime < (now - 1 hours), "Market has not finished");
        // do a final rent collection before the contract is locked down
        collectRentAllTokens();
        // lock everything down
        _incrementState();
        emit LogStep1Complete(true);
    }

    /// @notice the second of two functions which must be called, one after the other, to conclude the competition
    /// @notice this function checks whether the Realitio question has resolved, and if yes, gets the winner
    /// @dev can be called by anyone 
    function step2getWinner() external checkState(States.LOCKED) {
        require(_isQuestionFinalized() == true, "Oracle not resolved");
        // get the winner. This will revert if answer is not resolved.
        winningOutcome = _getWinner();
        // check if question resolved invalid
        if (winningOutcome !=  ((2**256)-1)) {
            questionResolvedInvalid = false;
        }
        _incrementState();
        emit LogStep2Complete(true, winningOutcome, questionResolvedInvalid);
    }

    /// @notice emergency function in case the Realitio question never resolves for whatever reason, can be called by anyone
    /// @notice returns all funds to all users
    /// @notice can only be called 1 month after Realitio question should have ended 
    function step2BemergencyExit() external checkState(States.LOCKED) {
        require(now > (marketExpectedResolutionTime + 4 weeks), "Must wait 1 month");
        _incrementState();
        emit LogStep2Complete(false, winningOutcome, false);
    }

    /// @notice Same as above, except that only owner can call it, and can be called whenever
    /// @notice to be clear, this only allows owner to return all funds, not to set a winner
    function step2CcircuitBreaker() external checkState(States.LOCKED) {
        require(msg.sender == owner, "Only owner can call this");
        _incrementState();
        emit LogStep2Complete(false, winningOutcome, false);
    }

    /// @notice the final function of the competition resolution process. Pays out winnings, or returns funds, as necessary
    /// @dev users pull dai into their ac   count. 
    function complete() external checkState(States.WITHDRAW) {
        if (!questionResolvedInvalid) {
            _payoutWinnings();
        } else {
             _returnRent();
        }
    }

     // * internal * 
    /// @notice pays winnings to the winners
    /// @dev must be internal and only called by complete
    function _payoutWinnings() internal {
        uint256 _winningsToTransfer = getWinnings(winningOutcome);
        require(_winningsToTransfer > 0, "Not a winner, or winnings already paid");
        timeHeld[winningOutcome][msg.sender] = 0; // otherwise they can keep paying themselves over and over
        _sendCash(msg.sender, _winningsToTransfer);
        emit LogWinningsPaid(msg.sender, _winningsToTransfer);
    }

    // * internal * 
    /// @notice returns all funds to users in case of invalid outcome
    /// @dev must be internal and only called by complete
    function _returnRent() internal {
        uint256 _rentCollected = collectedPerUser[msg.sender];
        require(_rentCollected > 0, "Paid no rent, or rent already returned");
        collectedPerUser[msg.sender] = 0; // otherwise they can keep paying themselves over and over
        _sendCash(msg.sender, _rentCollected);
        emit LogRentReturned(msg.sender, _rentCollected);
    }

    /// @notice withdraw full deposit after markets have resolved
    /// @dev the other withdraw deposit functions are locked when markets have closed so must use this one
    /// @dev can be called in either locked or withdraw state
    /// @dev this function is also different in that it does 
    /// @dev ... not attempt to collect rent or transfer ownership to a previous owner
    function withdrawDepositAfterMarketEnded() external {
        require(state != States.NFTSNOTMINTED, "Incorrect state");
        require(state != States.OPEN, "Incorrect state");
        for (uint i = 0; i < numberOfTokens; i++) {

            uint256 _depositToReturn = deposits[i][msg.sender];

            if (_depositToReturn > 0) {
                deposits[i][msg.sender] = 0;
                _sendCash(msg.sender, _depositToReturn);
                emit LogDepositWithdrawal(_depositToReturn, i, msg.sender);
            }
        }
    }

    ////////////////////////////////////
    ///// MAIN FUNCTIONS- EXTERNAL /////
    ////////////////////////////////////
    /// @dev basically functions that have checkState(States.OPEN) modifier

    /// @notice collects rent for all tokens
    /// @dev makes it easy for me to call whenever I want to keep people paying their rent, thus cannot be internal
    /// @dev cannot be external because it is called within the step1 functions, therefore public
    function collectRentAllTokens() public checkState(States.OPEN) {
       for (uint i = 0; i < numberOfTokens; i++) {
            _collectRent(i);
        }
    }
    
    /// @notice to rent a token
    function newRental(uint256 _newPrice, uint256 _tokenId, uint256 _deposit) external checkState(States.OPEN) tokenExists(_tokenId) amountNotZero(_deposit) {
        uint256 _currentPricePlusTenPercent = price[_tokenId].mul(11).div(10);
        uint256 _oneHoursDeposit = _newPrice.div(24);
        require(_newPrice >= _currentPricePlusTenPercent, "Price not 10% higher");
        require(_deposit >= _oneHoursDeposit, "One hour's rent minimum");
        require(_newPrice >= 0.01 ether, "Minimum rental 0.01 Dai");
        
        _collectRent(_tokenId);
        _depositDai(_deposit, _tokenId);

        address _currentOwner = token.ownerOf(_tokenId);

        if (_currentOwner == msg.sender) { // bought by current owner- just change price
            _changePrice(_newPrice, _tokenId);
        } else {   // bought by new user- the normal flow
            // update internals
            currentOwnerIndex[_tokenId] = currentOwnerIndex[_tokenId].add(1); 
            ownerTracker[_tokenId][currentOwnerIndex[_tokenId]].price = _newPrice;
            ownerTracker[_tokenId][currentOwnerIndex[_tokenId]].owner = msg.sender; 
            timeAcquired[_tokenId] = now;
            _transferTokenTo(_currentOwner, msg.sender, _newPrice, _tokenId);
            emit LogNewRental(msg.sender, _newPrice, _tokenId); 
        }
    }

    /// @notice add new dai deposit to an existing rental
    /// @dev it is possible a user's deposit could be reduced to zero following _collectRent
    /// @dev they would then increase their deposit despite no longer owning it
    /// @dev this is ok, they can still withdraw via withdrawDeposit. 
    /// @dev can be called by anyone- you can top up someone else's deposit if you wish!
    function depositDai(uint256 _dai, uint256 _tokenId) external checkState(States.OPEN) amountNotZero(_dai) tokenExists(_tokenId) {
        _collectRent(_tokenId);
        _depositDai(_dai, _tokenId);
    }

    /// @notice increase the price of an existing rental
    function changePrice(uint256 _newPrice, uint256 _tokenId) external checkState(States.OPEN) tokenExists(_tokenId) onlyTokenOwner(_tokenId) {
        require(_newPrice > price[_tokenId], "New price must be higher"); 
        _collectRent(_tokenId);
        _changePrice(_newPrice, _tokenId);
    }
    
    /// @notice withdraw deposit
    /// @dev do not need to be the current owner
    /// @dev public because called by exit
    function withdrawDeposit(uint256 _daiToWithdraw, uint256 _tokenId) public checkState(States.OPEN) tokenExists(_tokenId) amountNotZero(_daiToWithdraw) {
        _collectRent(_tokenId);
        uint256 _remainingDeposit = deposits[_tokenId][msg.sender];
        // deposits may be lower (or zero) then when function called due to _collectRent 
        if (_remainingDeposit > 0) { 
            if (_remainingDeposit < _daiToWithdraw) {
                _daiToWithdraw = _remainingDeposit;
            }
            _withdrawDeposit(_daiToWithdraw, _tokenId);
            emit LogDepositWithdrawal(_daiToWithdraw, _tokenId, msg.sender);
        }
    }

    /// @notice withdraw full deposit
    /// @dev do not need to be the current owner
    /// @dev no modifiers because they are on withdrawDeposit
    function exit(uint256 _tokenId) external {
        withdrawDeposit(deposits[_tokenId][msg.sender],  _tokenId);
    }

    ////////////////////////////////////
    ///// MAIN FUNCTIONS- INTERNAL /////
    ////////////////////////////////////

    /// @dev should only be called thrice
    function _incrementState() internal  {
        state = States(uint(state) + 1);
    }

    /// @notice collects rent for a specific token
    /// @dev also calculates and updates how long the current user has held the token for
    /// @dev called frequently internally, so cant be external. 
    /// @dev is not a problem if called externally, but making internal over public to save gas
    function _collectRent(uint256 _tokenId) internal {
        //only collect rent if the token is owned (ie, if owned by the contract this implies unowned)
        if (token.ownerOf(_tokenId) != address(this)) {
            
            uint256 _rentOwed = rentOwed(_tokenId);
            address _currentOwner = token.ownerOf(_tokenId);
            uint256 _timeOfThisCollection;
            
            if (_rentOwed >= deposits[_tokenId][_currentOwner]) {
                // run out of deposit. Calculate time it was actually paid for, then revert to previous owner 
                _timeOfThisCollection = timeLastCollected[_tokenId].add(((now.sub(timeLastCollected[_tokenId])).mul(deposits[_tokenId][_currentOwner]).div(_rentOwed)));
                _rentOwed = deposits[_tokenId][_currentOwner]; // take what's left     
                _revertToPreviousOwner(_tokenId);
                
            } else  {
                // normal collection
                _timeOfThisCollection = now;
            }

            // decrease deposit by rent owed
            deposits[_tokenId][_currentOwner] = deposits[_tokenId][_currentOwner].sub(_rentOwed);

            // update time held and amount collected variables
            uint256 _timeHeldToIncrement = (_timeOfThisCollection.sub(timeLastCollected[_tokenId])); //just for readability
            timeHeld[_tokenId][_currentOwner] = timeHeld[_tokenId][_currentOwner].add(_timeHeldToIncrement);
            totalTimeHeld[_tokenId] = totalTimeHeld[_tokenId].add(_timeHeldToIncrement);
            collectedPerUser[_currentOwner] = collectedPerUser[_currentOwner].add(_rentOwed);
            collectedPerToken[_tokenId] = collectedPerToken[_tokenId].add(_rentOwed);
            totalCollected = totalCollected.add(_rentOwed);

            emit LogRentCollection(_rentOwed, _tokenId);
        }

        // timeLastCollected is updated regardless of whether the token is owned, so that the clock starts ticking
        // ... when the first owner buys it, because this function is run before ownership changes upon calling
        // ... newRental
        timeLastCollected[_tokenId] = now;
    }

    /// @dev depositDai is split into two, because it needs to be called direct from newRental
    /// @dev ... without collecing rent first (otherwise it would be collected twice, possibly causing logic errors)
    function _depositDai(uint256 _dai, uint256 _tokenId) internal {
        deposits[_tokenId][msg.sender] = deposits[_tokenId][msg.sender].add(_dai);
        _receiveCash(msg.sender, _dai);
        emit LogDepositIncreased(_dai, _tokenId, msg.sender);
    }

    /// @dev changePrice is split into two, because it needs to be called direct from newRental
    /// @dev ... without collecing rent first (otherwise it would be collected twice, possibly causing logic errors)
    function _changePrice(uint256 _newPrice, uint256 _tokenId) internal {
        // below is the only instance when price is modifed outside of the _transferTokenTo function
        price[_tokenId] = _newPrice;
        ownerTracker[_tokenId][currentOwnerIndex[_tokenId]].price = _newPrice;
        emit LogPriceChange(price[_tokenId], _tokenId);
    }

    /// @notice actually withdraw the deposit and call _revertToPreviousOwner if necessary
    function _withdrawDeposit(uint256 _daiToWithdraw, uint256 _tokenId) internal {
        assert(deposits[_tokenId][msg.sender] >= _daiToWithdraw);
        address _currentOwner = token.ownerOf(_tokenId);

        // must rent for minimum of 1 hour for current owner
        if(_currentOwner == msg.sender) {
            uint256 _oneHour = 3600;
            uint256 _secondsOwned = now.sub(timeAcquired[_tokenId]);
            if (_secondsOwned < _oneHour) { 
                uint256 _oneHoursDeposit = price[_tokenId].div(24);
                uint256 _secondsStillToPay = _oneHour.sub(_secondsOwned);
                uint256 _minDepositToLeave = _oneHoursDeposit.mul(_secondsStillToPay).div(_oneHour);
                uint256 _maxDaiToWithdraw = deposits[_tokenId][msg.sender].sub(_minDepositToLeave);
                if (_maxDaiToWithdraw < _daiToWithdraw) {
                    _daiToWithdraw = _maxDaiToWithdraw;
                }
            }
        }

        deposits[_tokenId][msg.sender] = deposits[_tokenId][msg.sender].sub(_daiToWithdraw);
        
        if(_currentOwner == msg.sender && deposits[_tokenId][msg.sender] == 0) {
            _revertToPreviousOwner(_tokenId);
        }
        _sendCash(msg.sender, _daiToWithdraw);
    }

    /// @notice if a users deposit runs out, either return to previous owner or foreclose
    function _revertToPreviousOwner(uint256 _tokenId) internal {
        uint256 _index;
        address _previousOwner;

        // loop max ten times before just assigning it to that owner, to prevent block limit
        for (uint i=0; i < MAX_ITERATIONS; i++)  {
            currentOwnerIndex[_tokenId] = currentOwnerIndex[_tokenId].sub(1); // currentOwnerIndex will now point to  previous owner
            _index = currentOwnerIndex[_tokenId]; // just for readability
            _previousOwner = ownerTracker[_tokenId][_index].owner;

            // if no previous owners. price -> zero, foreclose
            // if previous owner still has a deposit, transfer to them, update the price to what it used to be
            if (_index == 0) {
                _foreclose(_tokenId);
                break;
            } else if (deposits[_tokenId][_previousOwner] > 0) {
                break;
            }  
        }   

        // if the above loop did not foreclose, then transfer to previous owner
        if (token.ownerOf(_tokenId) != address(this)) {
            address _currentOwner = token.ownerOf(_tokenId);
            uint256 _oldPrice = ownerTracker[_tokenId][_index].price;
            _transferTokenTo(_currentOwner, _previousOwner, _oldPrice, _tokenId);
            emit LogReturnToPreviousOwner(_tokenId, _previousOwner);
        }
    }

    /// @notice return token to the contract and return price to zero
    function _foreclose(uint256 _tokenId) internal {
        address _currentOwner = token.ownerOf(_tokenId);
        // third field is price, ie price goes to zero
        _transferTokenTo(_currentOwner, address(this), 0, _tokenId);
        emit LogForeclosure(_currentOwner, _tokenId);
    }

    /// @notice transfer ERC 721 between users
    /// @dev there is no event emitted as this is handled in ERC721.sol
    function _transferTokenTo(address _currentOwner, address _newOwner, uint256 _newPrice, uint256 _tokenId) internal {
        require(_currentOwner != address(0) && _newOwner != address(0) , "Cannot send to/from zero address");
        price[_tokenId] = _newPrice;
        token.transferRcOnly(_currentOwner, _newOwner, _tokenId);
    }

}

