import webdriver from 'selenium-webdriver';
import wd from 'wd';
import config from 'config';

const explicitWaitMS = config.get( 'explicitWaitMS' );
const mochaTimeOut = config.get( 'mochaTimeoutMS' );

export function clickWhenClickable( driver, selector ) {
	var self = this;
	return driver.wait( function() {
		return self.scrollToFindElement( driver, selector ).then( function( element ) {
			return element.click().then( function() {
				return true;
			}, function() {
				return false;
			} );
		}, function() {
			return false;
		} );
	}, explicitWaitMS, `Timed out waiting for element with ${selector.using} of '${selector.value}' to be clickable` );
}

export function clickIfPresent( driver, selector, attempts ) {
	if ( attempts === undefined ) {
		attempts = 1;
	}
	for ( let x = 0; x < attempts; x++ ) {
		this.scrollToFindElement( driver, selector ).then( function( element ) {
			element.click().then( function() {
				return true;
			}, function() {
				return true;
			} );
		}, function() {
			return true;
		} );
	}
}

export function waitForFieldClearable( driver, selector ) {
	var self = this;
	return driver.wait( function() {
		return self.scrollToFindElement( driver, selector ).then( ( element ) => {
			return element.clear();
		}, function() {
			return false;
		} );
	}, explicitWaitMS, `Timed out waiting for element with ${selector.using} of '${selector.value}' to be clearable` );
}

export function setWhenSettable( driver, selector, value, { secureValue = false } = {} ) {
	const logValue = secureValue === true ? '*********' : value;
	let self = this;
	return driver.wait( function() {
		return self.scrollToFindElement( driver, selector ).then( function( element ) {
			self.waitForFieldClearable( driver, selector );
			return element.sendKeys( value );
		}, function() {
			return false;
		} );
	}, explicitWaitMS, `Timed out waiting for element with ${selector.using} of '${selector.value}' to be settable to: '${logValue}'` ).then( function() {
		// Close soft keyboard after setting the input field to ensure the screen is visible
		if ( process.env.ORIENTATION === 'LANDSCAPE' ) {
			return global.__WDDRIVER__.hideKeyboard();
		}
	} );
}

/**
 * Check whether an image is actually visible - that is rendered to the screen - not just having a reference in the DOM
 * @param {webdriver} driver - Browser context in which to search
 * @param {WebElement} webElement - Element to search for
 * @returns {Promise} - Resolved when the script is done executing
 */
export function imageVisible( driver, webElement ) {
	return driver.executeScript( 'return (typeof arguments[0].naturalWidth!=\"undefined\" && arguments[0].naturalWidth>0)', webElement );
}

export function eyesScreenshot( driver, eyes, pageName, selector ) {
	console.log( `eyesScreenshot - ${pageName}` );

	// Remove focus to avoid blinking cursors in input fields
	// -- Works in Firefox, but not Chrome, at least on OSX I believe due to a
	// lack of "raw WebKit events".  It may work on Linux with CircleCI
	return driver.executeScript( 'document.activeElement.blur()' ).then( function() {
		driver.sleep( 1000 ).then( function() { // Wait 1 second to make sure everything's clean
			if ( selector ) {
				// If this is a webdriver.By selector
				if ( selector.using ) {
					eyes.checkRegionBy( selector, pageName );
				} else {
					eyes.checkRegionByElement( selector, pageName );
				}
			} else {
				eyes.checkWindow( pageName );
			}
		} );
	} );
}

/**
 * Scroll through the page looking for a given element
 * @param {webdriver} driver - Selenium browser object
 * @param {selector} selector - webdriver.By selector we're searching for
 * @param {integer} maxSwipes - Maximum number of times to try and scroll through the screen
 * @returns {Promise} - Resolved when the element is found, or maxSwipes is reached
 */
export function scrollToFindElement( driver, selector, { maxSwipes = 2 } = {} ) {
	var wdDriver = global.__WDDRIVER__;
	var interval;
	var d = webdriver.promise.defer();
	const intervalMS = 1000;

	var executeSearch = function() {
		interval = setInterval( function() {
			driver.findElement( selector ).then( function success( el ) {
				clearInterval( interval );
				d.fulfill( el );
			}, function failure() {
				if ( --maxSwipes <= 0 ) {
					clearInterval( interval );
					d.reject( -1 );
				} else { // Scroll down the height of the screen minus a 100px buffer
	//TODO: Extract the getWindowSize() outside so we only need to call it once, not on every interval
					driver.wait( wdDriver.getWindowSize().then( function( screenSize ) {
						let touchAction = new wd.TouchAction( wdDriver );
						return touchAction.press( { x: screenSize.width / 2, y: screenSize.height - 100 } )
							.moveTo( { x: 0, y: -1 * ( screenSize.height - 100 ) } )
							.release()
							.perform();
					} ), mochaTimeOut, 'Timed out getting screen size and scrolling' );
				}
			} );
		}, intervalMS );
	};

	// In landscape orientation we assume the keyboard is closed, or handled elsewhere
	//  - The hideKeyboard() function sometimes tries using 'back' to close the keyboard, which is driving bad navigation
	//  - In portrait orientation it must try another method to close the keyboard first, like tapping outside
	if ( process.env.ORIENTATION === 'LANDSCAPE' ) {
		executeSearch();
	} else {
		wdDriver.hideKeyboard().then( function success() {
			executeSearch();
		}, function failure() {
			executeSearch();
		} );
	}

	return d.promise;
}